"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useForecast } from "@/lib/hooks/useForecast";
import { ForecastChart } from "@/components/charts/ForecastChart";
import { ForecastInsights } from "@/components/forecast/ForecastInsights";
import { ForecastAccuracy } from "@/components/forecast/ForecastAccuracy";
import { ScenarioAnalysis } from "@/components/forecast/ScenarioAnalysis";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertCircle,
  Info,
  Lightbulb,
  Target,
  BarChart3,
  Shield,
  Zap,
  Clock,
  DollarSign,
  PieChart,
  LineChart as LineChartIcon,
  Car,
} from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useUser } from "@/lib/hooks/useUser";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function ForecastPage() {
  const {
    forecast,
    scenarios,
    isLoading,
    error,
    fetchForecast,
    fetchScenarios,
  } = useForecast();
  const [periods, setPeriods] = useState<number>(6);
  const [viewMode, setViewMode] = useState<
    "forecast" | "insights" | "scenarios"
  >("forecast");
  const { user } = useUser();
  const userId = user?.id ? Number(user.id) : 0;

  useEffect(() => {
    if (userId) {
      fetchForecast(userId, periods);
    }
  }, [periods, fetchForecast]);

  const handlePeriodsChange = (value: string) => {
    setPeriods(parseInt(value));
  };

  const handleViewModeChange = (
    mode: "forecast" | "insights" | "scenarios"
  ) => {
    setViewMode(mode);
    if (mode === "scenarios" && userId) {
      fetchScenarios(userId, periods);
    }
  };

  const calculateTotalForecast = () => {
    if (!forecast?.values) return 0;
    return forecast.values.reduce((a, b) => a + b, 0);
  };

  const calculateAverageMonthly = () => {
    if (!forecast?.values) return 0;
    return forecast.values.reduce((a, b) => a + b, 0) / forecast.values.length;
  };

  const getConfidenceColor = (confidence?: string) => {
    switch (confidence) {
      case "high":
        return "text-green-600 bg-green-100";
      case "medium":
        return "text-yellow-600 bg-yellow-100";
      case "low":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  AI Financial Advisor Forecast
                </h1>
                <p className="text-gray-600 mt-2 max-w-3xl">
                  Advanced predictions using machine learning that analyze
                  trends, seasonality, and patterns to help you anticipate
                  future expenses and make informed financial decisions.
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 bg-blue-50 px-4 py-2 rounded-lg">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-blue-700">
                    Last Updated:{" "}
                    {forecast ? new Date().toLocaleDateString() : "Never"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            {forecast && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">
                          Total Forecasted
                        </p>
                        <p className="text-2xl font-bold">
                          ${calculateTotalForecast().toLocaleString()}
                        </p>
                      </div>
                      <DollarSign className="h-8 w-8 text-blue-500" />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Over {periods} months
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">
                          Forecast Confidence
                        </p>
                        <p className="text-xl font-bold">
                          {forecast.accuracy_metrics?.interpretation ||
                            "Calculating..."}
                        </p>
                      </div>
                      <Shield className="h-8 w-8 text-purple-500" />
                    </div>
                    <div className="mt-2">
                      <Badge
                        className={getConfidenceColor(
                          forecast.accuracy_metrics?.confidence
                        )}
                      >
                        {forecast.accuracy_metrics?.confidence || "Unknown"}{" "}
                        confidence
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Data Quality</p>
                        <p className="text-xl font-bold">
                          {forecast.metadata?.total_transactions || 0}{" "}
                          transactions
                        </p>
                      </div>
                      <LineChartIcon className="h-8 w-8 text-orange-500" />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {forecast.metadata?.date_range?.days_covered || 0} days of
                      history
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Errors Display */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4 flex items-center space-x-3">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-red-800 font-semibold">Forecast Error</p>
                  <p className="text-red-700 text-sm">
                    {error} or you have not upload documents
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 border-red-300 text-red-700 hover:bg-red-100"
                    onClick={() => userId && fetchForecast(userId, periods)}
                  >
                    Retry Forecast
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 ml-2 border-blue-300 text-blue-700 hover:bg-blue-100"
                  >
                    <a href="/dashboard/upload">Upload your file</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Controls */}
          <Card>
            <CardContent>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 mt-3">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      Forecast Period:
                    </span>
                  </div>
                  <Select
                    value={periods.toString()}
                    onValueChange={handlePeriodsChange}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 Months</SelectItem>
                      <SelectItem value="6">6 Months</SelectItem>
                      <SelectItem value="12">12 Months</SelectItem>
                      <SelectItem value="24">24 Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Tabs
                  value={viewMode}
                  onValueChange={(v) => handleViewModeChange(v as any)}
                >
                  <TabsList>
                    <TabsTrigger
                      value="forecast"
                      className="flex items-center space-x-3"
                    >
                      <LineChartIcon className="h-4 w-4" />
                      <span>Forecast</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="insights"
                      className="flex items-center space-x-2"
                    >
                      <Lightbulb className="h-4 w-4" />
                      <span>Insights</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="scenarios"
                      className="flex items-center space-x-2"
                    >
                      <Target className="h-4 w-4" />
                      <span>Scenarios</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardContent>
          </Card>

          {/* Loading State */}
          {isLoading && (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="space-y-6">
                  <div className="relative inline-block">
                    <div className="relative">
                      <BarChart3 className="h-16 w-16 text-blue-400 animate-pulse mx-auto" />
                      <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-20"></div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Generating Forecast
                    </h3>
                    <p className="text-gray-600 mt-2 max-w-md mx-auto">
                      Analyzing historical patterns, detecting seasonality, and
                      calculating confidence intervals...
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Data Analysis</span>
                      <span>80%</span>
                    </div>
                    <Progress value={80} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Content based on view mode */}
          {!isLoading && forecast && (
            <>
              {viewMode === "forecast" && (
                <div className="space-y-6">
                  {/* Enhanced Forecast Chart */}
                  <ForecastChart forecast={forecast} />

                  {/* Component Analysis */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <PieChart className="h-5 w-5 text-blue-600" />
                        <span>Forecast Components</span>
                      </CardTitle>
                      <CardDescription>
                        Breakdown of what derives your forecast predictions
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium">
                              Underlying Trend
                            </span>
                            <span className="text-sm text-gray-600">
                              {forecast.seasonality_patterns?.trend_strength ||
                                "Unknown"}
                            </span>
                          </div>
                          <Progress
                            value={
                              forecast.seasonality_patterns?.trend_strength ===
                              "increasing"
                                ? 70
                                : forecast.seasonality_patterns
                                    ?.trend_strength === "decreasing"
                                ? 30
                                : 50
                            }
                            className="h-2"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium">
                              Seasonality Impact
                            </span>
                            <span className="text-sm text-gray-600">
                              {forecast.seasonality_patterns?.yearly_seasonality
                                ? "High"
                                : "Low"}
                            </span>
                          </div>
                          <Progress
                            value={
                              forecast.seasonality_patterns?.yearly_seasonality
                                ? 80
                                : 20
                            }
                            className="h-2"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium">
                              Data Volatility
                            </span>
                            <span className="text-sm text-gray-600">
                              Score:{" "}
                              {(
                                forecast.seasonality_patterns
                                  ?.volatility_score || 0
                              ).toFixed(2)}
                            </span>
                          </div>
                          <Progress
                            value={Math.min(
                              (forecast.seasonality_patterns
                                ?.volatility_score || 0) * 100,
                              100
                            )}
                            className="h-2"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {viewMode === "insights" && (
                <div className="space-y-6">
                  {/* Forecast Insights */}
                  <ForecastInsights insights={forecast.forecast_insights} />

                  {/* Accuracy Metrics */}
                  <ForecastAccuracy metrics={forecast.accuracy_metrics} />

                  {/* Recommendations */}
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        <span>Actionable Recommendations</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {forecast.recommendations?.map((rec, index) => (
                          <div
                            key={index}
                            className="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                          >
                            <div className="shrink-0 w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center">
                              <span className="text-yellow-800 text-sm font-bold">
                                {index + 1}
                              </span>
                            </div>
                            <p className="text-gray-800 leading-relaxed">
                              {rec}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {viewMode === "scenarios" && scenarios && (
                <ScenarioAnalysis scenarios={scenarios} />
              )}
            </>
          )}

          {/* Educational Information */}
          <Card className="bg-linear-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-blue-800">
                <Info className="h-5 w-5" />
                <span>How Our Forecasting Works</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-700">
                    Trend Analysis
                  </h4>
                  <p className="text-sm text-blue-600">
                    Identifies long-term patterns in your spending to predict
                    future directions
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-700">
                    Seasonality Detection
                  </h4>
                  <p className="text-sm text-blue-600">
                    Finds repeating patterns (weekly, monthly, yearly) in your
                    expenses
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-700">
                    Confidence Intervals
                  </h4>
                  <p className="text-sm text-blue-600">
                    Shows the range where your actual expenses are likely to
                    fall. Confidence can be predicted when accumulated data is
                    equal to 3 months or more
                  </p>
                </div>
              </div>
              <div className="mt-6 p-4 bg-white rounded-lg border border-blue-300">
                <p className="text-sm text-gray-700">
                  <strong>Important:</strong> Forecasts are predictions based on
                  historical patterns and may not account for unexpected life
                  events, economic changes, or unusual circumstances. Always
                  maintain an emergency fund and review your actual spending
                  regularly.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
