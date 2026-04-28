import { useState, useEffect, useCallback } from "react";
import { transactionsApi } from "@/lib/api/transactions";
import { useUser } from "@/lib/hooks/useUser";

export const useTransactionHistory = () => {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getTransactionHistory = useCallback(
    async (params?: {
      source?: "transactions";
      year?: number;
      month?: number;
      type?: string;
      category?: string;
      search?: string;
      page?: number;
      per_page?: number;
    }) => {
      if (!user?.id) return null;

      try {
        setLoading(true);
        setError(null);
        const res = await transactionsApi.getTransactionHitory(params);
        return res.data;
      } catch (error: any) {
        console.error("Error fetching transaction history:", error);
        setError(
          error.response?.data?.detail || "Failed to load transaction history"
        );
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  const getExtractedDocuments = useCallback(
    async (year?: number) => {
      if (!user?.id) return null;

      try {
        setLoading(true);
        setError(null);
        const res = await transactionsApi.getExtractedDocuments(year);
        return res.data;
      } catch (err: any) {
        console.error("Error fetching extracted documents:", err);
        setError(
          err.response?.data?.detail || "Failed to load extracted documents"
        );
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  const exportTransactions = useCallback(
    async (year?: number) => {
      if (!user?.id) throw new Error("User not authenticated");

      try {
        setLoading(true);
        setError(null);

        // Downloading the doucment
        const res = await transactionsApi.exportTransactions(year);

        const blob = new Blob([res], { type: "text/csv" });

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");

        const contentDisposition = res.headers?.["content-disposition"];
        let filename = `transactions_${year || "all"}.csv`;

        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1];
          }
        }

        link.href = url;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();

        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);

        return res;
      } catch (err: any) {
        console.error("Error exporting transactions:", err);

        if (err.res?.date instanceof Blob) {
          const errorText = await err.res.data.text();
          try {
            const errorJson = JSON.parse(errorText);
            setError(errorJson.detail || "Failed to export transactions");
          } catch {
            setError("Failed to export transactions");
          }
        } else {
          setError(err.res?.data?.detail || "Failed to export transactions");
        }

        throw err;
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  return {
    loading,
    error,
    getTransactionHistory,
    getExtractedDocuments,
    exportTransactions,
  };
};
