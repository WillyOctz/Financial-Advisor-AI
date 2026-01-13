import { useState, useEffect, useCallback } from "react";
import { forecastApi } from "@/lib/api/forecast";
import { ForecastResponse, ForecastScenario } from "@/types/financial";
import { apiClient } from "../api/client";

interface UseForecastResult {
  forecast: ForecastResponse | null;
  scenarios: ForecastScenario | null;
  isLoading: boolean;
  error: string | null;
  fetchForecast: (userId: number, periods?: number) => Promise<void>;
  fetchScenarios: (userId: number, periods?: number) => Promise<void>;
  clearForecast: () => void;
  downloadReport: (userId: number, periods?: number) => Promise<void>;
}

export const useForecast = (): UseForecastResult => {
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [scenarios, setScenarios] = useState<ForecastScenario | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchForecast = useCallback(
    async (userId: number, periods: number = 6) => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await forecastApi.getExpenseForecast(userId, periods);
        setForecast(data);
      } catch (error: any) {
        setError(error.response?.data?.detail || "Failed to fetch forecast");
        console.error("Forecast error:", error);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const fetchScenarios = useCallback(
    async (userId: number, periods: number = 6) => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await forecastApi.getForecastScenarios(userId, periods);
        setScenarios(data);
      } catch (error: any) {
        setError(
          error.response?.data?.detail || "Failed to fetch forecast scenarios"
        );
        console.error("Forecast scenarios error:", error);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const downloadReport = useCallback(
    async (userId: number, periods: number = 6) => {
      try {
        const blob = await forecastApi.downloadForecastReport(userId, periods);

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `forecast-report-${
          new Date().toISOString().split("T")[0]
        }.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error: any) {
        console.error("Failed to download report:", error);
      }
    },
    []
  );

  const clearForecast = () => {
    setForecast(null);
    setScenarios(null);
    setError(null);
  };

  return {
    forecast,
    scenarios,
    isLoading,
    error,
    fetchForecast,
    fetchScenarios,
    downloadReport,
    clearForecast,
  };
};
