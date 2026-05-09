import { ColumnMapping, Transaction } from "@/types/financial";
import { useState } from "react";
import { apiClient } from "../api/client";

interface UseUploadResult {
  isUploading: boolean;
  uploadError: string | null;
  uploadedTransactions: Transaction[];
  uploadDocument: (
    file: File,
    userId: number,
    columnMapping: ColumnMapping,
  ) => Promise<void>;
  clearUpload: () => void;
}

export const useUpload = (): UseUploadResult => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedTransactions, setUploadedTransactions] = useState<
    Transaction[]
  >([]);

  const uploadDocument = async (
    file: File,
    userId: number,
    columnMapping: ColumnMapping,
  ) => {
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("user_id", userId.toString());
      formData.append("column_mapping", JSON.stringify(columnMapping));

      const res = await apiClient.post("/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      const transactionsResponse = await apiClient.get(
        `/${res.data.document_id}/transactions`,
      );
      setUploadedTransactions(transactionsResponse.data);
    } catch (error: any) {
      setUploadError(error.response?.data?.detail || "Upload failed");
      throw error;
    } finally {
      //setIsUploading(false);
    }
  };

  const clearUpload = () => {
    setUploadedTransactions([]);
    setUploadError(null);
    setIsUploading(false);
  };

  return {
    isUploading,
    uploadError,
    uploadedTransactions,
    uploadDocument,
    clearUpload,
  };
};
