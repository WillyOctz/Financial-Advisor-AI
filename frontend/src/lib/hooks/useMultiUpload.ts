import { useState } from "react";
import { apiClient } from "@/lib/api/client";
import { ColumnMapping } from "@/types/financial";
import { useToast } from "@/components/ui/use-toast";
import { useUser } from "./useUser";

interface UploadTask {
  id: string;
  filename: string;
  status: "processing" | "completed" | "failed";
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

      // Initialize all as processing
      const newTasks: UploadTask[] = data.task_ids.map((id: string, i: number) => ({
        id,
        filename: filesToUpload[i].name,
        status: "processing" as const,
      }));

      setTasks(newTasks);

      // Poll every 15 seconds - MUCH less aggressive
      let pollCount = 0;
      const maxPolls = 40; // 10 minutes total
      
      const checkStatus = async () => {
        pollCount++;
        
        try {
          const token =
            typeof document !== "undefined"
              ? document.cookie
                  .split("; ")
                  .find((r) => r.startsWith("token="))
                  ?.split("=")[1]
              : undefined;

          // Check all tasks in one batch
          const statusPromises = newTasks.map(async (task) => {
            try {
              const res = await fetch(
                `${process.env.NEXT_PUBLIC_API || "http://localhost:8000/api/v1"}/task-status/${task.id}`,
                {
                  credentials: "include",
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                },
              );
              
              if (!res.ok) return null;
              return await res.json();
            } catch {
              return null;
            }
          });

          const statuses = await Promise.all(statusPromises);

          // Update task statuses
          const updatedTasks = newTasks.map((task, index) => {
            const statusData = statuses[index];
            if (!statusData) return task;

            return {
              ...task,
              status: statusData.status as UploadTask["status"],
            };
          });

          setTasks(updatedTasks);

          // Check if all done
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
              description: `${successCount} succeeded${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
              duration: 4000,
            });
            return;
          }

          // Continue polling
          if (pollCount < maxPolls) {
            setTimeout(checkStatus, 15000);  // 15 seconds - very relaxed
          } else {
            setIsProcessing(false);
            toast({
              title: "Timeout",
              description: "Processing is taking longer than expected",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error("Status check error:", error);
          if (pollCount < maxPolls) {
            setTimeout(checkStatus, 15000);
          }
        }
      };

      // Wait 10 seconds before first check (give ETL time to start)
      setTimeout(checkStatus, 10000);

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
          t.id === taskId ? { ...t, status: "failed" as const } : t
        ),
      );
      toast({
        title: "Cancelled",
        description: "Task cancelled successfully",
      });
    } catch (error) {
      console.error("Cancel failed:", error);
    }
  };

  const reset = () => {
    setFiles([]);
    setMappings([]);
    setTasks([]);
    setIsProcessing(false);
  };

  return {
    files,
    mappings,
    tasks,
    isProcessing,
    addFiles,
    removeFile,
    updateMapping,
    submitAll,
    cancelTask,
    reset,
  };
}