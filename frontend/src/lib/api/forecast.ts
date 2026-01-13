import { ForecastResponse, ForecastScenario } from "@/types/financial";
import { apiClient } from "./client";

export const forecastApi = {
  getExpenseForecast: async (
    userId: number,
    periods: number = 6
  ): Promise<ForecastResponse> => {
    const res = await apiClient.post("/forecast/expenses/enhanced", {
      user_id: userId,
      periods,
      frequency: "M",
    });
    return res.data;
  },

  getForecastScenarios: async (
    userId: number,
    periods: number = 6
  ): Promise<ForecastScenario> => {
    const res = await apiClient.post("/forecast/expenses/scenarios", {
      user_id: userId,
      periods,
      frequency: "M",
    });
    return res.data;
  },

  getForecastCompparison: async (
    userId: number,
    periods: number = 6
  ): Promise<any> => {
    const res = await apiClient.get(
      `/forecast/${userId}/comparison?periods=${periods}`
    );
    return res.data;
  },

  downloadForecastReport: async (
    userId: number,
    periods: number = 6
  ): Promise<any> => {
    const res = await apiClient.get(
      `/forecast/${userId}/report?periods=${periods}`,
      {
        responseType: "blob",
      }
    );
    return res.data;
  },

  clearForecastCache: async (userId: number): Promise<void> => {
    await apiClient.delete(`/forecast/${userId}/cache`);
  },
};
