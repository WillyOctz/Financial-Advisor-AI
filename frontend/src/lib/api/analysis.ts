import {
  AIAdviceResponse,
  FinancialSummary,
  AnomalyDetectionResult,
  RiskAssessment,
  FutureRiskPrediction,
  FinancialHealthCheck,
  DashboardSummary,
  AnalysisSummary,
} from "@/types/financial";
import { apiClient } from "./client";

export const analysisApi = {
  getFinancialSummary: async (
    userId: number,
    timeframe: string = "latest_month",
  ): Promise<FinancialSummary> => {
    const res = await apiClient.get(
      `/display/summary/${userId}?timeframe=${timeframe}`,
    );
    return res.data;
  },

  getDashboardSummary: async (userId: number): Promise<DashboardSummary> => {
    const res = await apiClient.get(`/display/dashboard/${userId}`);
    return res.data;
  },

  getAnalysisSummary: async (userId: number): Promise<AnalysisSummary> => {
    const res = await apiClient.get(`/display/analysis/${userId}`);
    return res.data;
  },

  getAIAdvice: async (
    userId: number,
    customPrompt?: string,
  ): Promise<AIAdviceResponse> => {
    const res = await apiClient.post("/display/advice", {
      user_id: userId,
      custom_prompt: customPrompt,
    });
    return res.data;
  },

  getTransactionAnomalies: async (
    userId: number,
    windowDays: number = 90,
  ): Promise<AnomalyDetectionResult> => {
    const res = await apiClient.get(`/predictive/anomalies/${userId}`, {
      params: { window_days: windowDays },
    });
    return res.data;
  },

  getFinancialRiskAssessment: async (
    userId: number,
  ): Promise<RiskAssessment> => {
    const res = await apiClient.get(`/predictive/risk-assessment/${userId}`);
    return res.data;
  },

  getFutureRisks: async (
    userId: number,
    horizonMonths: number = 6,
  ): Promise<FutureRiskPrediction> => {
    const res = await apiClient.get(`/predictive/future-risks/${userId}`, {
      params: { horizon_months: horizonMonths },
    });
    return res.data;
  },

  getFinancialHealthCheck: async (
    userId: number,
  ): Promise<FinancialHealthCheck> => {
    const res = await apiClient.get(`/predictive/financial-status/${userId}`);
    return res.data;
  },
};
