"use client";

import React, { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  onCancel?: () => void;
  isUploading?: boolean;
  acceptedTypes?: string[];
  maxSize?: number;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  onCancel,
  isUploading = false,
  acceptedTypes = [".csv", ".xlsx", ".xls"],
  maxSize = 10 * 1024 * 1024,
}) => {
  const [selectedFile, setSelectedFile] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      setError(null);

      // Handle rejected files
      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];

        if (rejection.errors[0]?.code === "file-too-large") {
          setError("File is too large. Max size is 10MB");
        } else if (rejection.errors[0]?.code === "file-invalid-type") {
          setError(
            `Invalid file type. Please upload ${acceptedTypes.join(", ")} files`,
          );
        } else {
          setError("Error uploading file. Please try again");
        }
        return;
      }

      // Handle accepted files
      if (acceptedFiles.length > 0) {
        setSelectedFile(acceptedFiles);
        onFileSelect(acceptedFiles);
      }
    },
    [onFileSelect, maxSize, acceptedTypes],
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept: {
        "text/csv": [".csv"],
        "application/vnd.ms-excel": [".xls"],
        "application/vnd.openxmlformats-officedocument.spreadsheethtml.sheet": [
          ".xlsx",
        ],
      },
      maxSize,
      multiple: true,
    });

  const removeFile = (index: number) => {
    setSelectedFile((files) => files.filter((_, i) => i !== index));
    setError(null);
  };

  const getFileIcon = (filename: string) => {
    if (filename.endsWith(".csv")) return FileText;
    if (filename.endsWith(".xlsx") || filename.endsWith(".xls"))
      return FileSpreadsheet;
    return FileText;
  };

  return (
    <Card className="border-0 shadow-xl">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              Upload Financial Data
            </CardTitle>
            <p className="text-sm text-slate-600 mt-2">
              Drag and drop your files or click to browse
            </p>
          </div>
          {isUploading && onCancel && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Cancel Upload
              </Button>
            </motion.div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* Drop zone */}
        {selectedFile.length === 0 ? (
          <div {...getRootProps()}>
            <motion.div
              className={`relative overflow-hidden border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300
              ${
                isDragActive && !isDragReject
                  ? "border-blue-500 bg-blue-50 scale-105"
                  : isDragReject
                    ? "border-red-500 bg-red-50"
                    : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-white"
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
            >
              <input {...getInputProps()} />

              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0 bg-linear-to-br from-blue-500 to-purple-500" />
              </div>

              {/* Icon */}
              <motion.div
                className="relative z-10"
                animate={isDragActive ? { y: [-5, 5, -5] } : {}}
                transition={{
                  duration: 1,
                  repeat: isDragActive ? Infinity : 0,
                  ease: "easeInOut",
                }}
              >
                <div className="w-20 h-20 mx-auto mb-6 bg-linear-to-br from-blue-100 to-cyan-100 rounded-2xl flex items-center justify-center">
                  <Upload
                    className={`w-10 h-10 ${
                      isDragActive ? "text-blue-600" : "text-blue-400"
                    } transition-colors`}
                  />
                </div>
              </motion.div>

              {/* Text */}
              <div className="relative z-10">
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  {isDragActive
                    ? isDragReject
                      ? "Invalid file type"
                      : "Drop your files here"
                    : "Drag & drop your files here"}
                </h3>
                <p className="text-slate-600 mb-4">
                  {isDragActive
                    ? "Release to upload"
                    : "or click to browse from your computer"}
                </p>

                {/* Supported Formats */}
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
                    CSV
                  </div>
                  <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
                    Excel
                  </div>
                  <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
                    Max 10MB
                  </div>
                </div>

                {isDragActive && (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Select Files
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        ) : (
          /* Files list */
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {selectedFile.map((file, index) => {
                const FileIcon = getFileIcon(file.name);

                return (
                  <motion.div
                    key={`${file.name}-${index}`}
                    initial={{ opacity: 0, x: -20, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: "auto" }}
                    exit={{ opacity: 0, x: 20, height: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="group"
                  >
                    <div className="flex items-center justify-between p-4 bg-linear-to-r from-slate-50 to-blue-50 border border-slate-200 rounded-xl hover:shadow-md transition-shadow">
                      {/* File Info */}
                      <div className="flex items-center space-x-4 flex-1">
                        {/* Icon */}
                        <motion.div
                          className="shrink-0 w-12 h-12 bg-linear-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg"
                          whileHover={{ rotate: 360 }}
                          transition={{ duration: 0.6 }}
                        >
                          <FileIcon className="w-6 h-6 text-white" />
                        </motion.div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 truncate">
                            {file.name}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-sm text-slate-600">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                            {!isUploading && (
                              <div className="flex items-center gap-1 text-emerald-600">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-xs font-medium">
                                  Ready
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Remove Button */}
                      {!isUploading && (
                        <motion.button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="shrink-0 p-2 hover:bg-red-50 rounded-lg transition-colors group"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <X className="w-5 h-5 text-slate-400 group-hover:text-red-600 transition-colors" />
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Add more button */}
            {!isUploading && (
              <div {...getRootProps()}>
                <motion.div
                  className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <input {...getInputProps()} />
                  <Upload className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600 font-medium">
                    Add more files
                  </p>
                </motion.div>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Upload error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="shrink-0 text-red-600 hover:text-red-800"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};
