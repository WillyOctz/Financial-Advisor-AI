import { ForecastResponse, ForecastScenario } from "@/types/financial";

export const forecastUtils = {
  calculateConfidenceScore: (forecast: ForecastResponse): number => {
    if (!forecast.accuracy_metrics) return 50;

    const { mape, confidence } = forecast.accuracy_metrics;

    let baseScore = 100 - Math.min(mape, 100);

    // Adjust based on confidence level
    switch (confidence) {
      case "high":
        baseScore *= 1.1;
      case "medium":
        baseScore *= 1.0;
      case "low":
        baseScore *= 0.8;
    }

    return Math.min(Math.max(baseScore, 0), 100);
  },

  getTrendDescription: (forecast: ForecastResponse): string => {
    const patterns = forecast.seasonality_patterns;
    if (!patterns) return "No trend detected";

    const { trend_strength, volatility_score } = patterns;

    if (trend_strength === "increasing") {
      if (volatility_score > 0.5) {
        return "Expenses showing volatile but increasing trend";
      }
      return "Expenses steadily increasing over time";
    } else if (trend_strength === "decreasing") {
      if (volatility_score > 0.5) {
        return "Expenses volatile but overall decreasing";
      }
      return "Expenses showing healthy decreasing trend";
    }
    return "Expenses relatively stable with minor fluctuations";
  },

  generateMonthlySummary: (
    forecast: ForecastResponse
  ): Array<{
    month: string;
    amount: number;
    confidence: number;
    recommendation: string;
  }> => {
    return forecast.dates.map((date, index) => {
      const amount = forecast.values[index];
      const confidenceRange =
        forecast.confidence_upper[index] - forecast.confidence_lower[index];
      const confidence = Math.max(0, 100 - (confidenceRange / amount) * 100);

      let recommendation = "Monitor spending as usual";
      if (
        amount >
        (forecast.values.reduce((a, b) => a + b, 0) / forecast.values.length) *
          1.2
      ) {
        recommendation = "Consider reviewing discretionary spending this month";
      }

      return {
        month: date,
        amount,
        confidence: Math.round(confidence),
        recommendation,
      };
    });
  },

  compareWithHistorical: (
    forecast: ForecastResponse
  ): {
    averageIncrease: number;
    maxMonthIncrease: number;
    seasonalityImpact: number;
  } => {
    if (!forecast.historical_data) {
      return { averageIncrease: 0, maxMonthIncrease: 0, seasonalityImpact: 0 };
    }

    const histAvg =
      forecast.historical_data.values.reduce((a, b) => a + b, 0) /
      forecast.historical_data.values.length;
    const forecastAvg =
      forecast.values.reduce((a, b) => a + b, 0) / forecast.values.length;

    return {
      averageIncrease: ((forecastAvg - histAvg) / histAvg) * 100,
      maxMonthIncrease:
        ((Math.max(...forecast.values) - histAvg) / histAvg) * 100,
      seasonalityImpact: forecast.seasonality_patterns?.yearly_seasonality
        ? 25
        : 0,
    };
  },
};
