"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, X, Sparkles } from "lucide-react";

interface UploadTask {
  id: string;
  filename: string;
  status: "processing" | "completed" | "failed";
}

interface UploadProgressProps {
  tasks: UploadTask[];
  isProcessing: boolean;
  onCancel?: (taskId: string) => void;
}

export const UploadProgress: React.FC<UploadProgressProps> = ({
  tasks,
  isProcessing,
  onCancel,
}) => {
  if (tasks.length === 0) return null;

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const failedCount = tasks.filter((t) => t.status === "failed").length;
  const processingCount = tasks.filter((t) => t.status === "processing").length;
  const allDone = processingCount === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="border-0 shadow-2xl overflow-hidden">
        {/* Header Banner */}
        <div
          className={`p-6 bg-linear-to-br ${
            allDone && failedCount === 0
              ? "from-emerald-500 via-green-500 to-teal-500"
              : allDone && failedCount > 0
                ? "from-amber-500 via-orange-500 to-rose-500"
                : "from-blue-600 via-indigo-600 to-purple-600"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                animate={!allDone ? { rotate: 360 } : { scale: [1, 1.2, 1] }}
                transition={
                  !allDone
                    ? { duration: 3, repeat: Infinity, ease: "linear" }
                    : { duration: 0.5 }
                }
              >
                {allDone && failedCount === 0 ? (
                  <CheckCircle2 className="w-7 h-7 text-white" />
                ) : allDone ? (
                  <XCircle className="w-7 h-7 text-white" />
                ) : (
                  <Sparkles className="w-7 h-7 text-white" />
                )}
              </motion.div>

              <div>
                <h3 className="text-white text-xl font-bold">
                  {allDone
                    ? failedCount === 0
                      ? "All Files Processed!"
                      : "Processing Complete"
                    : `Processing ${tasks.length} File${tasks.length !== 1 ? "s" : ""}`}
                </h3>
                <p className="text-white/80 text-sm mt-0.5">
                  {allDone
                    ? `${completedCount} succeeded${failedCount > 0 ? `, ${failedCount} failed` : ""}`
                    : `${completedCount} done • ${processingCount} in progress`}
                </p>
              </div>
            </div>

            {/* Animated dots while processing */}
            {!allDone && (
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2.5 h-2.5 bg-white rounded-full"
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                    transition={{
                      duration: 1.4,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Task List */}
        <CardContent className="p-4 space-y-3">
          <AnimatePresence mode="popLayout">
            {tasks.map((task, index) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <div
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-colors ${
                    task.status === "processing"
                      ? "bg-blue-50 border-blue-200"
                      : task.status === "completed"
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-red-50 border-red-200"
                  }`}
                >
                  {/* Status Icon */}
                  <div
                    className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                      task.status === "processing"
                        ? "bg-linear-to-br from-blue-400 to-indigo-500"
                        : task.status === "completed"
                          ? "bg-linear-to-br from-emerald-400 to-green-500"
                          : "bg-linear-to-br from-red-400 to-rose-500"
                    }`}
                  >
                    {task.status === "processing" ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : task.status === "completed" ? (
                      <motion.div
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <XCircle className="w-5 h-5 text-white" />
                      </motion.div>
                    )}
                  </div>

                  {/* Filename + Status */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate text-sm">
                      {task.filename}
                    </p>
                    <p
                      className={`text-xs font-medium mt-0.5 ${
                        task.status === "processing"
                          ? "text-blue-600"
                          : task.status === "completed"
                            ? "text-emerald-600"
                            : "text-red-600"
                      }`}
                    >
                      {task.status === "processing" && "Processing..."}
                      {task.status === "completed" &&
                        "✓ Completed successfully"}
                      {task.status === "failed" && "✗ Processing failed"}
                    </p>
                  </div>

                  {/* Cancel button (only while processing) */}
                  {task.status === "processing" && onCancel && (
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onCancel(task.id)}
                        className="shrink-0 w-8 h-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Footer hint while processing */}
          {isProcessing && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-xs text-slate-400 pt-1"
            >
              Checking status every 15 seconds — you can leave this page
            </motion.p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
