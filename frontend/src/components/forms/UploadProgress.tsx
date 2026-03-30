"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import { SSEProgressData } from "@/lib/sse/SSEConnection";

interface UploadProgressProps {
  uploadStage: string;
  uploadProgress: number;
  uploadDetails: string;
  uploadId?: string | null;
  onCancel?: () => void;
  isCancelling?: boolean;
  isComplete?: boolean;
  isError?: boolean;
}

export const UploadProgress: React.FC<UploadProgressProps> = ({
  uploadStage,
  uploadProgress,
  uploadDetails,
  uploadId,
  onCancel,
  isCancelling = false,
  isComplete = false,
  isError = false,
}) => {
  const getStatusColor = () => {
    if (isError) return "text-red-600";
    if (isComplete) return "text-green-600";
    return "text-blue-600";
  };

  const getStatusBgColor = () => {
    if (isError) return "bg-red-100";
    if (isComplete) return "bg-green-100";
    return "bg-blue-100";
  };

  return (
    <Card className="border-blue-200 mb-6 shadow-lg">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Header with cancel button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className={`w-10 h-10 ${getStatusBgColor()} rounded-full flex items-center justify-center`}
              >
                <Upload className={`w-5 h-5 ${getStatusColor()}`} />
              </div>
              <div>
                <h3 className={`font-semibold text-lg ${getStatusColor()}`}>
                  {uploadStage || "Processing Document..."}
                </h3>
                <p className="text-sm text-gray-700">
                  {uploadDetails ||
                    "Your document is being processed in parallel for optimal speed"}
                </p>
              </div>
            </div>
            {onCancel && !isComplete && !isError && (
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className={`text-2xl font-bold ${getStatusColor()}`}>
                    {uploadProgress}%
                  </div>
                  <div className="text-xs text-gray-500">Complete</div>
                </div>
                <Button
                  onClick={onCancel}
                  variant="outline"
                  size="sm"
                  disabled={isCancelling || uploadProgress >= 100}
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                >
                  {isCancelling ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-red-600"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Main Progress Bar */}
          <div className="space-y-2">
            <Progress value={uploadProgress} className="h-3" />
            <div className="flex justify-between text-xs text-gray-500">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Parallel Processing Visualization */}
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Parallel Processing</span>
                <span className="text-xs text-gray-500">
                  {Math.floor(uploadProgress / 25) + 1}/4 workers active
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((worker) => (
                  <div key={worker} className="relative">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (uploadProgress - (worker - 1) * 25) * 4)}%`,
                        }}
                      ></div>
                    </div>
                    <div className="text-center mt-1">
                      <span className="text-xs text-gray-500">
                        Worker {worker}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Estimated Time */}
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Estimated time remaining:
                </span>
                <span className="font-medium text-gray-900">
                  {uploadProgress < 30
                    ? "20-30 seconds"
                    : uploadProgress < 70
                      ? "10-15 seconds"
                      : "5 seconds"}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Parallel processing is{" "}
                {uploadProgress < 30
                  ? "starting up"
                  : uploadProgress < 70
                    ? "running at full speed"
                    : "wrapping up"}
              </div>
            </div>
          )}

          {/* Upload ID for debugging */}
          {uploadId && (
            <div className="pt-4 border-t">
              <div className="text-xs text-gray-500">
                Upload ID:{" "}
                <code className="bg-gray-100 px-1 rounded">{uploadId}</code>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
