import {
  ColumnMapping,
  DocumentUploadResponse,
  Transaction,
} from "@/types/financial";
import { apiClient } from "./client";

export const documentsApi = {
  uploadDocument: async (
    file: File,
    userId: number,
    columnMapping: ColumnMapping
  ): Promise<DocumentUploadResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("user_id", userId.toString());
    formData.append("column_mapping", JSON.stringify(columnMapping));

    console.log("Uploading document...", {
      filename: file.name,
      userId,
      columnMapping,
      size: file.size,
    });

    try {
      const res = await apiClient.post("/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 60000,
      });
      console.log("✅ Upload response:", res.data);
      return res.data;
    } catch (error: any) {
      console.error("❌ Upload failed:", error);
      if (error.code === "ECONNABORTED") {
        throw new Error(
          "Upload timeout. The file might be too large or the server is taking too long to process."
        );
      }
      throw error;
    }
  },

  getDocumentTransactions: async (
    documentId: number
  ): Promise<Transaction[]> => {
    const response = await apiClient.get(`/${documentId}/transactions`);
    return response.data;
  },
};
