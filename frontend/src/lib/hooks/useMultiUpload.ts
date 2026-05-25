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

    // Validate all files have mappings
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

      // Append all files
      filesToUpload.forEach((file) => {
        formData.append("files", file);
      });

      formData.append("user_id", user.id.toString());
      formData.append("column_mappings_json", JSON.stringify(mappingsToUse));
      formData.append("priority", "medium");
      formData.append("dependencies_json", "[]");

      // Get token from cookie
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

      // Initialize tasks from response
      const newTasks: UploadTask[] = data.task_ids.map((id: string, i: number) => ({
        id,
        filename: filesToUpload[i].name,
        status: "pending" as const,
        progress: 0,
      }));

      setTasks(newTasks);

      // SIMPLIFIED POLLING - No more SSE!
      let pollCount = 0;
      const maxPolls = 120; // 10 minutes max (120 * 5 seconds)
      
      const pollStatuses = async () => {
        pollCount++;
        
        try {
          const token =
            typeof document !== "undefined"
              ? document.cookie
                  .split("; ")
                  .find((r) => r.startsWith("token="))
                  ?.split("=")[1]
              : undefined;

          // Batch fetch all statuses in parallel (much more efficient!)
          const statusPromises = newTasks.map(async (task: UploadTask) => {
            try {
              const statusRes = await fetch(
                `${process.env.NEXT_PUBLIC_API || "http://localhost:8000/api/v1"}/task-status/${task.id}`,
                {
                  credentials: "include",
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                },
              );
              
              if (!statusRes.ok) {
                console.warn(`Failed to fetch status for task ${task.id}`);
                return null;
              }
              return await statusRes.json();
            } catch (error) {
              console.error(`Error fetching status for task ${task.id}:`, error);
              return null;
            }
          });

          const statuses = await Promise.all(statusPromises);

          // Update tasks based on status
          const updatedTasks = newTasks.map((task, index) => {
            const statusData = statuses[index];
            if (!statusData) return task;

            return {
              ...task,
              status: statusData.status as UploadTask["status"],
              progress: statusData.percentage || 0,
              error: statusData.error,
            };
          });

          setTasks(updatedTasks);

          // Check if all tasks are complete
          const allDone = updatedTasks.every(
            (t) => t.status === "completed" || t.status === "failed"
          );

          if (allDone) {
            setIsProcessing(false);
            onComplete?.();
            
            const successCount = updatedTasks.filter(
              (t) => t.status === "completed"
            ).length;
            
            const failedCount = updatedTasks.filter(
              (t) => t.status === "failed"
            ).length;
            
            toast({
              title: "Processing Complete!",
              description: `${successCount} succeeded${failedCount > 0 ? `, ${failedCount} failed` : ''}.`,
              duration: 4000,
            });
            return; // Stop polling
          }

          // Continue polling if not done and under max polls
          if (pollCount < maxPolls) {
            // Adaptive polling: 
            // - First 6 polls (30s): every 2s (fast feedback)
            // - Next 14 polls (70s): every 5s (normal)
            // - After that: every 10s (slower for long tasks)
            const delay = pollCount <= 6 ? 2000 : pollCount <= 20 ? 5000 : 10000;
            setTimeout(pollStatuses, delay);
          } else {
            // Timeout
            setIsProcessing(false);
            toast({
              title: "Processing Timeout",
              description: "Some files are still processing. Check back later.",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error("Polling error:", error);
          // Continue polling on error (network glitch, etc.)
          if (pollCount < maxPolls) {
            setTimeout(pollStatuses, 5000);
          }
        }
      };

      // Start polling after 1 second (give backend time to initialize)
      setTimeout(pollStatuses, 1000);

      toast({
        title: "Upload Started",
        description: `Processing ${filesToUpload.length} file(s) in parallel...`,
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
      toast({
        title: "Cancel Failed",
        description: "Could not cancel the task.",
        variant: "destructive",
      });
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