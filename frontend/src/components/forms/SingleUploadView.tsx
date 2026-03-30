"use client";

import { useState, useEffect } from "react";
import { FileUpload } from "@/components/forms/FileUpload";
import { ColumnMapping } from "@/components/forms/ColumnMapping";
import { UploadProgress } from "@/components/forms/UploadProgress";
import { ColumnMapping as ColumnMappingType } from "@/types/financial";
import { useUpload } from "@/lib/hooks/useUpload";
import { useUser } from "@/lib/hooks/useUser";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowLeft } from "lucide-react";
import { SSEConnection, SSEProgressData } from "@/lib/sse/SSEConnection";

export function SingleUploadView() {
  const [currentStep, setCurrentStep] = useState<
    "upload" | "mapping" | "complete"
  >("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { isUploading, uploadError, clearUpload } = useUpload();
  const { user } = useUser();
  const { toast } = useToast();

  // SSE states
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStage, setUploadStage] = useState("");
  const [uploadDetails, setUploadDetails] = useState("");
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [transactionCount, setTransactionCount] = useState(0);
  const [sseConnection, setSseConnection] = useState<SSEConnection | null>(
    null,
  );
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (sseConnection) {
        sseConnection.disconnect();
      }
    };
  }, [sseConnection]);

  // Handle upload errors
  useEffect(() => {
    if (uploadError) {
      setUploadStage("Upload Failed");
      setUploadDetails(uploadError);
      setUploadProgress(0);
      setIsProcessing(false);
      toast({
        title: "Upload Failed",
        description: uploadError,
        variant: "destructive",
      });
    }
  }, [uploadError, toast]);

  const getAuthToken = (): string | null => {
    if (typeof window === "undefined") return null;
    const token = localStorage.getItem("token");
    if (token) return token;
    const cookies = document.cookie.split("; ");
    const tokenCookie = cookies.find((row) => row.startsWith("token="));
    if (tokenCookie) return tokenCookie.split("=")[1];
    return null;
  };

  const connectToSSEStream = (uploadId: string) => {
    if (sseConnection) {
      sseConnection.disconnect();
    }

    const token = getAuthToken();
    const connection = new SSEConnection({
      uploadId,
      token,
      maxRetries: 10,
      retryDelay: 2000,
      onConnected: () => {
        setUploadDetails("Connected to progress stream...");
        toast({
          title: "Connected",
          description: "Tracking upload progress...",
          duration: 2000,
        });
      },
      onProgress: (data: SSEProgressData) => {
        setUploadStage(data.stage);
        setUploadProgress(data.percentage);
        setUploadDetails(data.details);
        setCancelled(data.can_cancel ?? true);
      },
      onComplete: async (data: SSEProgressData) => {
        if (data.is_error) {
          toast({
            title: "Processing Error",
            description: data.details || "An error occurred",
            variant: "destructive",
          });
          setCurrentStep("upload");
          setIsProcessing(false);
        } else {
          const count =
            data.metadata?.transaction_count ||
            (data.details
              ? parseInt(data.details.match(/\d+/)?.[0] || "0")
              : 0);
          toast({
            title: "Processing Complete!",
            description: data.details || "Document processed successfully",
          });
          setCurrentStep("complete");
          setTransactionCount(count);
          setIsProcessing(false);
        }
      },
      onError: (error, willRetry) => {
        if (!cancelled) {
          setUploadDetails(
            `Connection issue: ${error.message}${willRetry ? " (Retrying...)" : ""}`,
          );
        }
      },
    });

    setSseConnection(connection);
    connection.connect();
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setCurrentStep("mapping");
    setUploadProgress(0);
    setUploadStage("");
    setUploadDetails("");
    setUploadId(null);
    setDocumentId(null);
    setCancelled(false);
  };

  const handleMappingComplete = async (mapping: ColumnMappingType) => {
    if (!selectedFile || !user?.id) {
      toast({
        title: "Error",
        description: "Please select a file and ensure you're logged in.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setUploadProgress(0);
    setUploadStage("Starting upload...");
    setUploadDetails("Initializing upload...");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("user_id", user.id.toString());
      formData.append("column_mapping", JSON.stringify(mapping));

      const apiUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:8000";
      const token = getAuthToken();

      const res = await fetch(`${apiUrl}/api/v1/upload`, {
        method: "POST",
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        throw new Error(`Upload failed: ${res.statusText}`);
      }

      const data = await res.json();

      if (data.upload_id) {
        setUploadId(data.upload_id);
        setDocumentId(data.document_id);
        connectToSSEStream(data.upload_id);

        toast({
          title: "Upload Started",
          description: "Your document is being processed",
        });
      } else {
        throw new Error("No upload ID received");
      }
    } catch (error: any) {
      console.error("Upload failed:", error);
      setUploadStage("Upload failed");
      setUploadDetails(error.message || "Please try again");
      setUploadProgress(0);
      setIsProcessing(false);

      toast({
        title: "Upload Failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleCancelUpload = async () => {
    if (!uploadId) return;

    setIsCancelling(true);

    if (sseConnection) {
      sseConnection.disconnect();
      setSseConnection(null);
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:8000";
      const token = getAuthToken();

      const res = await fetch(`${apiUrl}/api/v1/cancel-upload/${uploadId}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
        setCancelled(true);
        setUploadStage("Cancelled");
        setUploadDetails("Upload was cancelled by user");
        setUploadProgress(0);
        setIsProcessing(false);

        toast({
          title: "Upload Cancelled",
          description: "File upload has been cancelled",
        });

        setTimeout(() => {
          handleNewUpload();
          setIsCancelling(false);
          setCancelled(false);
        }, 2000);
      }
    } catch (error) {
      console.error("Cancel failed:", error);
      setIsCancelling(false);
      setIsProcessing(false);

      toast({
        title: "Cancel Failed",
        description: "Could not cancel upload",
        variant: "destructive",
      });
    }
  };

  const handleNewUpload = () => {
    if (sseConnection) {
      sseConnection.disconnect();
      setSseConnection(null);
    }
    setSelectedFile(null);
    setCurrentStep("upload");
    setIsProcessing(false);
    clearUpload();
    setUploadProgress(0);
    setUploadStage("");
    setUploadDetails("");
    setUploadId(null);
    setDocumentId(null);
    setCancelled(false);
  };

  const handleBackToUpload = () => {
    setCurrentStep("upload");
    setSelectedFile(null);
    setIsProcessing(false);
    setUploadProgress(0);
  };

  // Progress Steps Component
  const UploadSteps = () => (
    <div className="flex items-center justify-center mb-8">
      <div className="flex items-center space-x-4">
        <div
          className={`flex items-center ${currentStep === "upload" ? "text-blue-600" : "text-gray-400"}`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              currentStep === "upload"
                ? "border-blue-600 bg-blue-50"
                : "border-gray-300"
            }`}
          >
            1
          </div>
          <span className="ml-2 font-medium">Upload File</span>
        </div>
        <div className="w-12 h-0.5 bg-gray-300" />
        <div
          className={`flex items-center ${currentStep === "mapping" ? "text-blue-600" : "text-gray-400"}`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              currentStep === "mapping"
                ? "border-blue-600 bg-blue-50"
                : "border-gray-300"
            }`}
          >
            2
          </div>
          <span className="ml-2 font-medium">Map Columns</span>
        </div>
        <div className="w-12 h-0.5 bg-gray-300" />
        <div
          className={`flex items-center ${currentStep === "complete" ? "text-green-600" : "text-gray-400"}`}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              currentStep === "complete"
                ? "border-green-600 bg-green-50"
                : "border-gray-300"
            }`}
          >
            {currentStep === "complete" ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              3
            )}
          </div>
          <span className="ml-2 font-medium">Complete</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <UploadSteps />

      {/* Progress Bar */}
      {(isProcessing || uploadProgress > 0) &&
        currentStep === "mapping" &&
        !cancelled && (
          <UploadProgress
            uploadStage={uploadStage}
            uploadProgress={uploadProgress}
            uploadDetails={uploadDetails}
            uploadId={uploadId}
            onCancel={handleCancelUpload}
            isCancelling={isCancelling}
            isComplete={uploadStage === "Completed"}
            isError={uploadStage === "Error"}
          />
        )}

      {/* Step Content */}
      {currentStep === "upload" && (
        <FileUpload onFileSelect={handleFileSelect} />
      )}

      {currentStep === "mapping" && selectedFile && !isProcessing && (
        <>
          <Button
            variant="ghost"
            onClick={handleBackToUpload}
            className="mb-2 -ml-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to file selection
          </Button>
          <ColumnMapping
            file={selectedFile}
            onMappingComplete={handleMappingComplete}
          />
        </>
      )}

      {currentStep === "complete" && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-green-900 mb-2">
              Upload Successful!
            </h3>
            <p className="text-green-700 mb-4">
              Successfully processed {transactionCount} transactions.
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={handleNewUpload} variant="outline">
                Upload Another File
              </Button>
              <Button>
                <a href="/dashboard/analysis">View Analysis</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
