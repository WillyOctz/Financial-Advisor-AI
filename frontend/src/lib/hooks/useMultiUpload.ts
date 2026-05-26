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

    const missingMappings = mappingsToUse.some((m) => !m);
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

      filesToUpload.forEach((file) => {
        formData.append("files", file);
      });

      formData.append("user_id", user.id.toString());
      formData.append("column_mappings_json", JSON.stringify(mappingsToUse));
      formData.append("priority", "medium");
      formData.append("dependencies_json", "[]");

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
        throw new Error(errData.detail || "Upload failed");
      }

      const data = await res.json();

      const newTasks: UploadTask[] = data.task_ids.map((id: string, i: number) => ({
        id,
        filename: filesToUpload[i].name,
        status: "processing" as const,  // Just show processing, no intermediate states
        progress: 50,  // Static 50% while processing
      }));

      setTasks(newTasks);

      // ULTRA-SIMPLE POLLING: Just check every 10 seconds until done
      let pollCount = 0;
      const maxPolls = 60; // 10 minutes max
      
      const checkCompletion = async () => {
        pollCount++;
        
        try {
          const token =
            typeof document !== "undefined"
              ? document.cookie
                  .split("; ")
                  .find((r) => r.startsWith("token="))
                  ?.split("=")[1]
              : undefined;

          // Single batch request for all statuses
          const statusPromises = newTasks.map(async (task) => {
            try {
              const statusRes = await fetch(
                `${process.env.NEXT_PUBLIC_API || "http://localhost:8000/api/v1"}/task-status/${task.id}`,
                {
                  credentials: "include",
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                },
              );
              
              if (!statusRes.ok) return null;
              return await statusRes.json();
            } catch {
              return null;
            }
          });

          const statuses = await Promise.all(statusPromises);

          // Only care about final states: completed or failed
          const updatedTasks = newTasks.map((task, index) => {
            const statusData = statuses[index];
            if (!statusData) return task;

            const isDone = statusData.status === "completed" || statusData.status === "failed";

            return {
              ...task,
              status: statusData.status as UploadTask["status"],
              progress: isDone ? 100 : 50,  // 50% = processing, 100% = done
              error: statusData.error,
            };
          });

          setTasks(updatedTasks);

          const allDone = updatedTasks.every(
            (t) => t.status === "completed" || t.status === "failed"
          );

          if (allDone) {
            setIsProcessing(false);
            onComplete?.();
            
            const successCount = updatedTasks.filter((t) => t.status === "completed").length;
            const failedCount = updatedTasks.filter((t) => t.status === "failed").length;
            
            toast({
              title: "Complete!",
              description: `${successCount} file(s) processed${failedCount > 0 ? `, ${failedCount} failed` : ''}.`,
              duration: 4000,
            });
            return;
          }

          // Continue checking every 10 seconds (much less aggressive)
          if (pollCount < maxPolls) {
            setTimeout(checkCompletion, 10000);  // 10 seconds
          } else {
            setIsProcessing(false);
            toast({
              title: "Timeout",
              description: "Processing is taking longer than expected. Check back later.",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error("Status check error:", error);
          if (pollCount < maxPolls) {
            setTimeout(checkCompletion, 10000);
          }
        }
      };

      // Start checking after 5 seconds (give backend time to start)
      setTimeout(checkCompletion, 5000);

      toast({
        title: "Upload Started",
        description: `Processing ${filesToUpload.length} file(s)...`,
        duration: 2000,
      });
      
      return true;
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "An error occurred",
        variant: "destructive",
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
          t.id === taskId ? { ...t, status: "failed" as const, progress: 0 } : t
        ),
      );
      toast({
        title: "Task Cancelled",
        description: "The task has been cancelled.",
      });
    } catch (error) {
      console.error("Failed to cancel task:", error);
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