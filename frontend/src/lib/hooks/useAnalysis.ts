import {
  AIAdviceResponse,
  AnomalyDetectionResult,
  FinancialHealthCheck,
  FinancialSummary,
  FutureRiskPrediction,
  RiskAssessment,
} from "@/types/financial";
import { useState, useCallback } from "react";
import { apiClient } from "../api/client";

interface UseAnalysisResult {
  summary: FinancialSummary | null;
  advice: AIAdviceResponse | null;
  isLoading: boolean;
  error: string | null;
  anomalies: AnomalyDetectionResult | null;
  riskAssessment: RiskAssessment | null;
  futureRisks: FutureRiskPrediction | null;
  healthCheck: FinancialHealthCheck | null;
  fetchSummary: (userId: number, timeframe?: string) => Promise<void>;
  generateAdvice: (userId: number, customPrompt?: string) => Promise<void>;
  fetchAnomalies: (userId: number, windowDays?: number) => Promise<void>;
  fetchRiskAssessment: (userId: number) => Promise<void>;
  fetchFutureRisks: (userId: number, horizonMonths?: number) => Promise<void>;
  fetchHealthCheck: (userId: number) => Promise<void>;
}

export const useAnalysis = (): UseAnalysisResult => {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [advice, setAdvice] = useState<AIAdviceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyDetectionResult | null>(
    null
  );
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(
    null
  );
  const [futureRisks, setFutureRisks] = useState<FutureRiskPrediction | null>(
    null
  );
  const [healthCheck, setHealthCheck] = useState<FinancialHealthCheck | null>(
    null
  );

  // Warp with use callback for fetchSummary and generateAdvice to prevent infinite render
  const fetchSummary = useCallback(
    async (userId: number, timeframe: string = "latest_month") => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await apiClient.get(`/display/summary/${userId}`, {
          params: { timeframe },
        });
        setSummary(res.data);
      } catch (error: any) {
        setError(error.response?.data?.detail || "Failed to get summary");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const generateAdvice = useCallback(
    async (userId: number, customPrompt?: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await apiClient.post("/display/advice", {
          user_id: userId,
          custom_prompt: customPrompt,
        });
        setAdvice(res.data);
      } catch (error: any) {
        setError(error.response?.data?.detail || "Failed to generate advice");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const fetchAnomalies = useCallback(
    async (userId: number, windowDays: number = 90) => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await apiClient.get(`/predictive/anomalies/${userId}`, {
          params: { window_days: windowDays },
        });
        setAnomalies(res.data);
      } catch (err: any) {
        setError(err.response?.data?.detail || "Failed to detect anomalies");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const fetchRiskAssessment = useCallback(async (userId: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await apiClient.get(`/predictive/risk-assessment/${userId}`);
      setRiskAssessment(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to assess risks");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchFutureRisks = useCallback(
    async (userId: number, horizonMonths: number = 6) => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await apiClient.get(`/predictive/future-risks/${userId}`);
        setFutureRisks(res.data);
      } catch (err: any) {
        setError(
          err.response?.data?.detail || "Failed to predict future risks"
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const fetchHealthCheck = useCallback(async (userId: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await apiClient.get(`/predictive/financial-status/${userId}`);
      setHealthCheck(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to get health status");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    summary,
    advice,
    isLoading,
    error,
    anomalies,
    riskAssessment,
    futureRisks,
    healthCheck,
    fetchSummary,
    generateAdvice,
    fetchAnomalies,
    fetchRiskAssessment,
    fetchFutureRisks,
    fetchHealthCheck,
  };
};
