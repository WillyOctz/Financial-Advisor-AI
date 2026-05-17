import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api/client";
import { CurrencyCode } from "@/lib/utils/currency";

interface CurrencyPreferences {
  currency: CurrencyCode;
  autoConvert: boolean;
}

interface UseCurrencyResult {
  currency: CurrencyCode;
  isLoading: boolean;
  error: string | null;
  setCurrency: (currency: CurrencyCode) => Promise<void>;
  refreshCurrency: () => Promise<void>;
}

export const useCurrency = (): UseCurrencyResult => {
  const [currency, setCurrencyState] = useState<CurrencyCode>("USD");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCurrency = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await apiClient.get("/users/preferences");
      const userCurrency = res.data.currency || "USD";

      setCurrencyState(userCurrency);
      localStorage.setItem("currency", userCurrency);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Failed to load currency preference",
      );

      // fallback to localstorage or default
      const savedCurrency = localStorage.getItem("currency") as CurrencyCode;
      if (savedCurrency) {
        setCurrencyState(savedCurrency);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // load currency preference from localStorage on mount
  useEffect(() => {
    const savedCurrency = localStorage.getItem("currency") as CurrencyCode;
    if (savedCurrency && (savedCurrency === "USD" || savedCurrency === "IDR")) {
      setCurrencyState(savedCurrency);
    } else {
      // fetch from backend
      refreshCurrency();
    }
  }, [refreshCurrency]);

  const setCurrency = useCallback(async (newCurrency: CurrencyCode) => {
    setIsLoading(true);
    setError(null);

    try {
      await apiClient.patch("/users/preferences", {
        currency: newCurrency,
      });

      // update local state and storage
      setCurrencyState(newCurrency);
      localStorage.setItem("currency", newCurrency);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Failed to update currency preference",
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    currency,
    isLoading,
    error,
    setCurrency,
    refreshCurrency,
  };
};
