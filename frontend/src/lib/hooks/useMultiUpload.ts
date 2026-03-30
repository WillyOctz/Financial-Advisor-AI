import { useState } from "react";
import { apiClient } from "@/lib/api/client";
import { ColumnMapping } from "@/types/financial";
import { useToast } from "@/components/ui/use-toast";
import { useUser } from "./useUser";

interface UploadTask {
  id: string;
  filename: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  error?: string;
}

export function useMultiUpload() {
  const [files, setFiles] = useState<File[]>([]);
  const [mappings, setMappings] = useState<(ColumnMapping | null)[]>([]);
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useUser();
  const { toast } = useToast();

  const addFiles = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    setMappings((prev) => [...prev, ...newFiles.map(() => null)]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setMappings((prev) => prev.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, mapping: ColumnMapping) => {
    setMappings((prev) => {
      const updated = [...prev];
      updated[index] = mapping;
      return updated;
    });
  };

  const submitAll = async (
    filesToUpload: File[],
    mappingsToUse: (ColumnMapping | null)[],
    onComplete?: () => void,
  ) => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "Please log in",
        variant: "destructive",
      });
      return false;
    }

    // validate all files have mappings
    const missingMappings = mappings.some((m) => !m);
    if (missingMappings) {
      toast({
        title: "Incomplete",
        description: "Please map columns for all files",
        variant: "destructive",
      });
      return false;
    }

    setIsProcessing(true);

    try {
      const formData = new FormData();

      // append all files
      filesToUpload.forEach((file) => {
        formData.append("files", file);
      });

      formData.append("user_id", user.id.toString());
      formData.append("column_mappings_json", JSON.stringify(mappingsToUse));
      formData.append("priority", "medium");
      formData.append("dependencies_json", "[]");

      // get token from cookie
      const token =
        typeof document !== "undefined"
          ? document.cookie
              .split("; ")
              .find((r) => r.startsWith("token="))
              ?.split("=")[1]
          : undefined;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API || "http://localhost:8000/api/v1"}/upload-multiple`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: formData,
        },
      );

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(JSON.stringify(errData));
      }

      const data = await res.json();

      // initialize tasks from response
      const newTasks = data.task_ids.map((id: string, i: number) => ({
        id,
        filename: filesToUpload[i].name,
        status: "pending" as const,
        progress: 0,
      }));

      setTasks(newTasks);

      // track displayed progress seperatively from real progress
      const displayedProgress: Record<string, number> = {};
      newTasks.forEach((t: UploadTask) => {
        displayedProgress[t.id] = 0;
      });

      let pollInterval: ReturnType<typeof setInterval>;

      pollInterval = setInterval(async () => {
        const token =
          typeof document !== "undefined"
            ? document.cookie
                .split("; ")
                .find((r) => r.startsWith("token="))
                ?.split("=")[1]
            : undefined;

        const updatedTasks = await Promise.all(
          newTasks.map(async (task: UploadTask) => {
            try {
              const statusRes = await fetch(
                `${process.env.NEXT_PUBLIC_API || "http://localhost:8000/api/v1"}/task-status/${task.id}`,
                {
                  credentials: "include",
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                },
              );
              if (!statusRes.ok) return task;
              const statusData = await statusRes.json();

              // real progress based on status
              const targetProcess =
                statusData.status === "completed"
                  ? 100
                  : statusData.status === "processing"
                    ? 75
                    : statusData.status === "pending"
                      ? 15
                      : 0;

              // animate displayed progress toward target - max + 20 per tick
              const prev = displayedProgress[task.id] ?? 0;
              const animated = Math.min(targetProcess, prev + 20);
              displayedProgress[task.id] = animated;

              return {
                ...task,
                status: (statusData.status === "completed"
                  ? "completed"
                  : statusData.status === "failed"
                    ? "failed"
                    : statusData.status === "processing"
                      ? "processing"
                      : "pending") as UploadTask["status"],
                progress: animated,
              };
            } catch {
              return task;
            }
          }),
        );

        setTasks(updatedTasks);

        // Check completion
        const allDone = updatedTasks.every(
          (t) => t.status === "completed" || t.status === "failed",
        );

        if (allDone) {
          clearInterval(pollInterval); // clear interval
          setIsProcessing(false); // immediate stop the processing process
          onComplete?.();
          toast({
            title: "All Done!",
            description: `${updatedTasks.filter((t) => t.status === "completed").length} file(s) processed successfully.`,
            duration: 3000,
          });
        }
      }, 3000);

      toast({
        title: "Upload Started",
        description: `Processing ${files.length} in parallel...`,
        duration: 2000,
      });
      return true;
    } catch (error: any) {
      toast({
        title: "Upload Failed!",
        description: error.message,
        duration: 2000,
      });
      setIsProcessing(false);
      return false;
    }
  };

  const cancelTask = async (taskId: string) => {
    try {
      await apiClient.post(`/task/${taskId}/cancel`);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: "failed" as const } : t,
        ),
      );
    } catch (error) {
      console.error("Failed to cancel task: ", error);
    }
  };

  const reset = () => {
    setFiles([]);
    setMappings([]);
    setTasks([]);
    setIsProcessing(false);
  };

  const overallProgress =
    tasks.length > 0
      ? Math.round(tasks.reduce((acc, t) => acc + t.progress, 0) / tasks.length)
      : 0;

  return {
    files,
    mappings,
    tasks,
    isProcessing,
    overallProgress,
    addFiles,
    removeFile,
    updateMapping,
    submitAll,
    cancelTask,
    reset,
  };
}
