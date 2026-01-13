import { blob } from "stream/consumers";
import { apiClient } from "./client";

export interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string;
  document_id: number;
  created_at: string;
}

export interface MonthlyTransactionsResponse {
  transactions: Transaction[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
  summary: {
    total_income: number;
    total_expenses: number;
    net_savings: number;
    transaction_count: number;
    avg_income: number;
    avg_expenses: number;
    top_categories: Array<{
      category: string;
      amount: number;
      count: number;
    }>;
    income_by_month: Array<{ month: string; amount: number }>;
    expense_by_month: Array<{ month: string; amount: number }>;
  };
  filters: {
    year?: number;
    month?: number;
    transaction_type: string;
    category?: string;
    search_query?: string;
  };
}

export interface YearlyOverview {
  year: number;
  total_income: number;
  total_expenses: number;
  net_savings: number;
  savings_rate: number;
  transaction_count: number;
  monthly_breakdown: Array<{
    month: number;
    month_name: string;
    income: number;
    expenses: number;
    net_savings: number;
    transaction_count: number;
  }>;
  category_distribution: Array<{
    category: string;
    amount: number;
    percentage: number;
    count: number;
  }>;
  avg_monthly_income: number;
  avg_monthly_expenses: number;
}

export interface SearchResult {
  id: number;
  date: string;
  description: string;
  amount: number;
  type: string;
  category: string;
  document_id: number;
}

export const transactionsApi = {
  getTransactionHitory: async (params?: {
    source?: string;
    year?: number;
    month?: number;
    type?: string;
    category?: string;
    search?: string;
    page?: number;
    per_page?: number;
  }) => {
    const res = await apiClient.get("/transactions/history", { params });
    return res.data;
  },

  getExtractedDocuments: async (year?: number) => {
    const res = await apiClient.get("/transactions/extracted-documents", {
      params: { year },
    });
    return res.data;
  },

  exportTransactions: async (year?: number) => {
    const res = await apiClient.get("/transactions/export", {
      params: { year },
      responseType: "blob",
    });
    return res.data;
  },

  getAvailableYears: async () => {
    const res = await apiClient.get("/transactions/years");
    return res.data;
  },

  getCategories: async () => {
    const res = await apiClient.get("/transactions/categories");
    return res.data;
  },
};
