"use client";

import { useState, useEffect } from "react";
import { useMultiUpload } from "@/lib/hooks/useMultiUpload";
import { FileUpload } from "@/components/forms/FileUpload";
import { ColumnMapping } from "@/components/forms/ColumnMapping";
import { ColumnMapping as ColumnMappingType } from "@/types/financial";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  FileText,
  X,
  ChevronDown,
  ChevronUp,
  Upload,
  ArrowLeft,
} from "lucide-react";

interface FileWithMapping {
  file: File;
  mapping: ColumnMappingType | null;
  isExpanded: boolean;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  error?: string;
}

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
      console.error("Failed to process files:", error);
      setIsProcessing(false);
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
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "processing":
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <FileText className="w-5 h-5 text-gray-400" />;
    }
  };

  // file queue view
  if (!showMapping) {
    return (
      <div className="space-y-6">
        {/* File Upload Area */}
        <FileUpload
          onFileSelect={handleFileSelect}
          isUploading={isProcessing}
          onCancel={handleReset}
          acceptedTypes={[".csv", ".xlsx", ".xls"]}
        />

        {/* File Queue */}
        {files.length > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Upload Queue ({files.length} files)</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    {completedCount} of {files.length} completed
                  </p>
                </div>
                <div className="flex space-x-2">
                  {!isProcessing && (
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Clear All
                    </Button>
                  )}
                  <Button
                    onClick={handleAllProcess}
                    disabled={isProcessing || files.some((f) => !f.mapping)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Process All Files
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Overall Progress Bar */}
              {isProcessing && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Overall Progress</span>
                    <span className="font-medium">{overallProgress}%</span>
                  </div>
                  <Progress value={overallProgress} className="h-2" />
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-3">
              {files.map((fileItem, index) => (
                <div
                  key={`${fileItem.file.name}-${index}`}
                  className={`border rounded-lg p-4 transition-colors ${
                    fileItem.status === "completed"
                      ? "bg-green-50 border-green-200"
                      : fileItem.status === "failed"
                        ? "bg-red-50 border-red-200"
                        : "bg-white hover:bg-gray-50"
                  }`}
                >
                  {/* File Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      {getStatusIcon(fileItem.status)}
                      <div className="flex-1">
                        <div className="flex items-center">
                          <p className="font-medium text-gray-900">
                            {fileItem.file.name}
                          </p>
                          <span className="ml-2 text-xs text-gray-500">
                            ({(fileItem.file.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                        <div className="flex items-center mt-1">
                          {fileItem.mapping ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                              ✓ Columns mapped
                            </span>
                          ) : (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                              ⚠ Mapping required
                            </span>
                          )}
                          {fileItem.status === "processing" && (
                            <span className="ml-2 text-xs text-blue-600">
                              Processing: {fileItem.progress}%
                            </span>
                          )}
                          {fileItem.error && (
                            <span className="ml-2 text-xs text-red-600">
                              Error: {fileItem.error}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {!isProcessing &&
                        fileItem.status === "pending" &&
                        !fileItem.mapping && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartMapping(index)}
                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                          >
                            Map Columns
                          </Button>
                        )}
                      {!isProcessing && fileItem.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveFile(index)}
                          className="text-gray-500 hover:text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                      {isProcessing && fileItem.status === "processing" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelFile(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleExpand(index)}
                      >
                        {fileItem.isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {fileItem.isExpanded && (
                    <div className="mt-4 pl-8 border-t pt-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">File type:</span>
                          <span className="ml-2 font-medium">
                            {fileItem.file.name.split(".").pop()?.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Added:</span>
                          <span className="ml-2 font-medium">
                            {new Date().toLocaleString()}
                          </span>
                        </div>
                        {fileItem.mapping && (
                          <>
                            <div>
                              <span className="text-gray-500">
                                Date column:
                              </span>
                              <span className="ml-2 font-medium">
                                {fileItem.mapping.date}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">
                                Amount column:
                              </span>
                              <span className="ml-2 font-medium">
                                {fileItem.mapping.amount}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Individual Progress Bar */}
                  {fileItem.status === "processing" &&
                    fileItem.progress !== undefined && (
                      <div className="transition-all duration-700 ease-in-out">
                        <Progress value={overallProgress} className="h-2" />
                      </div>
                    )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // column mapping view
  const currentFile =
    currentFileIndex !== null ? files[currentFileIndex] : null;

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        onClick={handleBackToFileList}
        className="mb-2 -ml-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to file queue
      </Button>

      {currentFile && (
        <div className="space-y-4">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <FileText className="w-6 h-6 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">
                    Mapping columns for: {currentFile.file.name}
                  </p>
                  <p className="text-sm text-blue-700">
                    File {currentFileIndex !== null ? currentFileIndex + 1 : 0}{" "}
                    of {files.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <ColumnMapping
            file={currentFile.file}
            onMappingComplete={handleMappingComplete}
          />
        </div>
      )}
    </div>
  );
}
