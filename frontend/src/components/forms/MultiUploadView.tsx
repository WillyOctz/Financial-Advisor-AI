"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useMultiUpload } from "@/lib/hooks/useMultiUpload";
import { FileUpload } from "@/components/forms/FileUpload";
import { ColumnMapping } from "@/components/forms/ColumnMapping";
import { UploadProgress } from "@/components/forms/UploadProgress";
import { ColumnMapping as ColumnMappingType } from "@/types/financial";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  FileText,
  X,
  ChevronDown,
  Upload,
  ArrowLeft,
  Zap,
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Play,
  Trash,
} from "lucide-react";

interface FileWithMapping {
  file: File;
  mapping: ColumnMappingType | null;
  isExpanded: boolean;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  error?: string;
  uploadId?: string;
}

// animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
} satisfies Variants;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
} satisfies Variants;

const fileCardVariants = {
  hidden: { opacity: 0, scale: 0.8, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 20,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    x: -50,
    transition: { duration: 0.2 },
  },
} satisfies Variants;

export function MultiUploadView() {
  const [files, setFiles] = useState<FileWithMapping[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState<number | null>(null);
  const [showMapping, setShowMapping] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  const { submitAll, reset, tasks } = useMultiUpload();
  const { toast } = useToast();

  // update overall progress
  useEffect(() => {
    if (files.length > 0) {
      const completed = files.filter((f) => f.status === "completed").length;
      setCompletedCount(completed);

      const totalProgress = files.reduce((acc, file) => {
        if (file.status === "completed") return acc + 100;
        if (file.status === "failed") return acc + 0;
        return acc + (file.progress || 0);
      }, 0);

      setOverallProgress(Math.round(totalProgress / files.length));
    }
  }, [files]);

  // sync with usemultiupload tasks
  useEffect(() => {
    if (tasks.length > 0) {
      setFiles((prev) =>
        prev.map((file, index) => {
          const task = tasks[index];
          if (task) {
            return {
              ...file,
              status: task.status,
              progress: task.progress,
              error: task.error,
            };
          }
          return file;
        }),
      );
    }
  }, [tasks]);

  const handleFileSelect = (selectedFiles: File[]) => {
    // Rename parameter to avoid confusion
    const newFileItems: FileWithMapping[] = [];

    selectedFiles.forEach((file) => {
      // Check for duplicate - compare with existing files in state
      const isDuplicate = files.some(
        (existingFile) =>
          existingFile.file.name === file.name &&
          existingFile.file.size === file.size,
      );

      if (isDuplicate) {
        toast({
          title: "Duplicate File",
          description: `${file.name} has already been added`,
          variant: "destructive",
          duration: 2000,
        });
        return;
      }

      const newFile: FileWithMapping = {
        file,
        mapping: null,
        isExpanded: true,
        status: "pending",
        progress: 0,
      };

      newFileItems.push(newFile);
    });

    if (newFileItems.length > 0) {
      setFiles((prev) => [...prev, ...newFileItems]);
    }

    // auto expand the first file for mapping if this is the first file
    if (files.length === 0 && newFileItems.length > 0) {
      setCurrentFileIndex(0);
      setShowMapping(true);
    }

    if (newFileItems.length > 0) {
      toast({
        title: "Files Added",
        description: `${newFileItems.length} file(s) added to queue`,
        duration: 2000,
      });
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (currentFileIndex === index) {
      setCurrentFileIndex(null);
      setShowMapping(false);
    } else if (currentFileIndex && currentFileIndex > index) {
      setCurrentFileIndex((prev) => (prev !== null ? prev - 1 : null));
    }

    toast({
      title: "File Removed",
      description: "File removed from queue",
      duration: 1500,
    });
  };

  const handleMappingComplete = (mapping: ColumnMappingType) => {
    if (currentFileIndex !== null) {
      setFiles((prev) => {
        const updated = [...prev];
        updated[currentFileIndex] = {
          ...updated[currentFileIndex],
          mapping,
          isExpanded: false,
          status: "pending",
        };
        return updated;
      });

      // find the next file without mapping
      const nextIndex = files.findIndex(
        (f, i) =>
          i !== currentFileIndex && !f.mapping && f.status === "pending",
      );

      if (nextIndex !== -1) {
        setCurrentFileIndex(nextIndex);
        toast({
          title: "Next File Ready",
          description: `Please map columns for ${files[nextIndex].file.name}`,
          duration: 2000,
        });
      } else {
        setCurrentFileIndex(null);
        setShowMapping(false);
        toast({
          title: "All Files Mapped",
          description: "Ready to process all files",
          duration: 2000,
        });
      }
    }
  };

  const handleStartMapping = (index: number) => {
    setCurrentFileIndex(index);
    setShowMapping(true);
    setFiles((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], isExpanded: true };
      return updated;
    });
  };

  const handleToggleExpand = (index: number) => {
    setFiles((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        isExpanded: !updated[index].isExpanded,
      };
      return updated;
    });
  };

  const handleAllProcess = async () => {
    // check if all files have mappings
    const missingMappings = files.some((f) => !f.mapping);

    if (missingMappings) {
      toast({
        title: "Missing Mappings",
        description: "Please map columns for all files before processing",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    setIsProcessing(true);

    try {
      const rawFiles = files.map((f) => f.file);
      const rawMappings = files.map((f) => f.mapping);

      const success = await submitAll(rawFiles, rawMappings, () => {
        setIsProcessing(false);
      });
      if (!success) {
        setIsProcessing(false);
      }
    } catch (error) {
      //console.error("Failed to process files:", error);
      setIsProcessing(false);
      toast({
        title: "Processing Failed",
        description: "An error occurred while processing files",
        variant: "destructive",
      });
    }
  };

  const handleCancelFile = async (index: number) => {
    // implement cancel logic for individual file
    setFiles((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        status: "failed",
        error: "Cancelled by user",
      };
      return updated;
    });

    toast({
      title: "File Cancelled",
      description: files[index].file.name,
      duration: 2000,
    });
  };

  const handleReset = () => {
    setFiles([]);
    setCurrentFileIndex(null);
    setShowMapping(false);
    setOverallProgress(0);
    setCompletedCount(0);
    setIsProcessing(false);
    reset();
  };

  const handleBackToFileList = () => {
    setShowMapping(false);
    setCurrentFileIndex(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <CheckCircle className="w-6 h-6 text-green-600" />
          </motion.div>
        );
      case "failed":
        return (
          <motion.div
            animate={{ rotate: [0, -10, 10, -10, 0] }}
            transition={{ duration: 0.5 }}
          >
            <XCircle className="w-6 h-6 text-red-600" />
          </motion.div>
        );
      case "processing":
        return (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="w-6 h-6 text-blue-600" />
          </motion.div>
        );
      default:
        return <Clock className="w-6 h-6 text-slate-400" />;
    }
  };

  // file queue view
  if (!showMapping) {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* File upload area */}
        <motion.div variants={itemVariants}>
          <FileUpload
            onFileSelect={handleFileSelect}
            isUploading={isProcessing}
          />
        </motion.div>

        {/* Overall Progress Header */}
        <AnimatePresence>
          {isProcessing && files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              variants={itemVariants}
            >
              <Card className="border-0 shadow-2xl overflow-hidden">
                <div className="bg-linear-to-r from-blue-600 via-purple-600 to-cyan-600 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <motion.div
                        animate={{
                          rotate: [0, 360],
                          scale: [1, 1.1, 1],
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                        }}
                      >
                        <Sparkles className="w-7 h-7 text-white" />
                      </motion.div>
                      <div>
                        <h3 className="text-white text-2xl font-bold">
                          Processing {files.length} File{" "}
                          {files.length !== 1 ? "s" : ""}
                        </h3>
                        <p className="text-blue-100 text-sm mt-1">
                          {completedCount} of {files.length} completed
                        </p>
                      </div>
                    </div>

                    <motion.div
                      className="text-right"
                      key={overallProgress}
                      initial={{ scale: 1.3 }}
                      animate={{ scale: 1 }}
                    >
                      <div className="text-4xl font-bold text-white">
                        {overallProgress}%
                      </div>
                      <p className="text-blue-100 text-sm">Overall</p>
                    </motion.div>
                  </div>

                  <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-white rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${overallProgress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Files Queue */}
        {files.length > 0 && (
          <motion.div variants={itemVariants}>
            <Card className="border-0 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-linear-to-br from-slate-700 via-slate-800 to-slate-900 p-6">
                <CardHeader className="p-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-7 h-7 text-white" />
                      <div>
                        <CardTitle className="text-white text-2xl font-bold">
                          File Queue
                        </CardTitle>
                        <p className="text-slate-300 text-sm mt-1">
                          {files.length} file {files.length !== 1 ? "s" : ""}{" "}
                          ready for upload
                        </p>
                      </div>
                    </div>

                    {!isProcessing && (
                      <div className="flex items-center gap-3">
                        <Button
                          onClick={handleReset}
                          variant="outline"
                          className="bg-rose-300 text-rose-700 hover:bg-rose-400 shadow-lg h-12 px-6 font-bold"
                        >
                          <Trash className="w-5 h-5 mr-2"/>
                          Delete All
                        </Button>
                        <Button
                          onClick={handleAllProcess}
                          disabled={files.some((f) => !f.mapping)}
                          className="bg-white text-slate-900 hover:bg-slate-100 shadow-lg h-12 px-6 font-bold"
                        >
                          <Play className="w-5 h-5 mr-2" />
                          Process All
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
              </div>

              {/* Files list */}
              <CardContent className="p-6 space-y-4">
                <AnimatePresence mode="popLayout">
                  {files.map((fileItem, index) => (
                    <motion.div
                      key={`${fileItem.file.name}-${index}`}
                      variants={fileCardVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      layout
                      className="group"
                    >
                      {/* Use uploadprogress for processing files */}
                      {fileItem.status === "processing" ? (
                        <UploadProgress
                          uploadStage={`Processing ${fileItem.file.name}`}
                          uploadProgress={fileItem.progress || 0}
                          uploadDetails={`Uploading and validating your file...`}
                          uploadId={fileItem.uploadId}
                          onCancel={() => handleCancelFile(index)}
                          isComplete={false}
                          isError={false}
                        />
                      ) : (
                        // File card for non processing files
                        <div
                          className={`relative overflow-hidden rounded-2xl border-2 transition-all ${
                            fileItem.status === "completed"
                              ? "border-green-300 bg-linear-to-r from-green-50 to-emerald-50"
                              : fileItem.status === "failed"
                                ? "border-red-300 bg-linear-to-r from-red-50 to-rose-50"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
                          }`}
                        >
                          <div className="relative p-5">
                            {/* File Header */}
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                {/* Status Icon */}
                                <motion.div
                                  whileHover={{ scale: 1.1 }}
                                  className="shrink-0"
                                >
                                  {getStatusIcon(fileItem.status)}
                                </motion.div>

                                {/* File info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <FileSpreadsheet className="w-4 h-4 text-slate-500 shrink-0" />
                                    <p className="font-bold text-slate-900 truncate">
                                      {fileItem.file.name}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-slate-500">
                                      {(
                                        fileItem.file.size /
                                        1024 /
                                        1024
                                      ).toFixed(2)}{" "}
                                      MB
                                    </span>

                                    {/* Status Badge */}
                                    {fileItem.mapping ? (
                                      <motion.span
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium"
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                        Mapped
                                      </motion.span>
                                    ) : (
                                      <motion.span
                                        animate={{ scale: [1, 1.05, 1] }}
                                        transition={{
                                          duration: 2,
                                          repeat: Infinity,
                                        }}
                                        className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium"
                                      >
                                        <AlertTriangle className="w-3 h-3" />
                                        Need Mapping
                                      </motion.span>
                                    )}

                                    {fileItem.error && (
                                      <span className="text-xs text-red-600 font-medium">
                                        {fileItem.error}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-2 shrink-0">
                                {!isProcessing &&
                                  fileItem.status === "pending" &&
                                  !fileItem.mapping && (
                                    <motion.div
                                      whileHover={{ scale: 1.05 }}
                                      whileTap={{ scale: 0.95 }}
                                    >
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleStartMapping(index)
                                        }
                                        className="border-blue-300 text-blue-600 hover:bg-blue-50 font-medium"
                                      >
                                        <Zap className="w-4 h-4 mr-1" />
                                        Map Columns
                                      </Button>
                                    </motion.div>
                                  )}

                                {!isProcessing &&
                                  fileItem.status === "pending" && (
                                    <motion.div
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                    >
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveFile(index)}
                                        className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                                      >
                                        <X className="w-5 h-5" />
                                      </Button>
                                    </motion.div>
                                  )}

                                <motion.div
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                >
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleToggleExpand(index)}
                                    className="text-slate-400 hover:text-slate-600"
                                  >
                                    <motion.div
                                      animate={{
                                        rotate: fileItem.isExpanded ? 180 : 0,
                                      }}
                                    >
                                      <ChevronDown className="w-5 h-5" />
                                    </motion.div>
                                  </Button>
                                </motion.div>
                              </div>
                            </div>

                            {/* Expanded Details */}
                            <AnimatePresence>
                              {fileItem.isExpanded && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.3 }}
                                  className="mt-4 pt-4 border-t border-slate-200"
                                >
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <span className="font-bold text-slate-900 mt-1">
                                        Type:
                                      </span>
                                      <p className="font-bold text-slate-900 mt-1">
                                        {fileItem.file.name
                                          .split(".")
                                          .pop()
                                          ?.toUpperCase()}
                                      </p>
                                    </div>
                                    <div>
                                      <span className="text-slate-500 font-medium">
                                        Status:
                                      </span>
                                      <p className="font-bold text-slate-900 mt-1 capitalize">
                                        {fileItem.status}
                                      </p>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Empty State */}
        {files.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-2 border-dashed border-slate-300">
              <CardContent className="p-12 text-center">
                <motion.div
                  animate={{
                    y: [0, -10, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <Upload className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                </motion.div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  No Files In Queue
                </h3>
                <p className="text-slate-600">
                  Upload files above to get started
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    );
  }

  // column mapping view
  const currentFile =
    currentFileIndex !== null ? files[currentFileIndex] : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Button
          variant="ghost"
          onClick={handleBackToFileList}
          className="mb-2 -ml-2 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Queue
        </Button>
      </motion.div>

      {/* Current file info */}
      {currentFile && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-0 shadow-lg bg-linear-to-br from-blue-50 to-purple-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <motion.div
                  animate={{
                    rotate: [0, 360],
                  }}
                  transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="shrink-0"
                >
                  <div className="w-12 h-12 bg-linear-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                </motion.div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-lg truncate">
                    {currentFile.file.name}
                  </p>
                  <p className="text-sm text-blue-700 font-medium">
                    File {currentFileIndex !== null ? currentFileIndex + 1 : 0}{" "}
                    of {files.length}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">
                    {currentFileIndex !== null ? currentFileIndex + 1 : 0}
                    <span className="text-slate-500">/{files.length}</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Column Mapping Component */}
      {currentFile && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <ColumnMapping
            file={currentFile.file}
            onMappingComplete={handleMappingComplete}
          />
        </motion.div>
      )}
    </motion.div>
  );
}
