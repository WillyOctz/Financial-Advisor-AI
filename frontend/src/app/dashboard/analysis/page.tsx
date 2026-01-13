"use client";

import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAnalysis } from "@/lib/hooks/useAnalysis";
import { IncomeExpenseChart } from "@/components/charts/IncomeExpenseChart";
import { CategoryChart } from "@/components/charts/CategoryChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercentage } from "@/lib/utils/formatters";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Heart,
} from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useUser } from "@/lib/hooks/useUser";
import PredictiveForm from "@/components/forms/PredictiveForm";

export default function AnalysisPage() {
  const { summary, advice, isLoading, error, fetchSummary, generateAdvice } =
    useAnalysis();
  const [timeframe, setTimeFrame] = useState<"latest_month" | "all_time">(
    "latest_month"
  );
  const { user } = useUser();
  const userId = user?.id ? Number(user.id) : 0;

  useEffect(() => {
    if (userId) {
      fetchSummary(userId, timeframe);
    }
  }, [userId, timeframe]);

  const handleTimeframeChange = (newTimeframe: "latest_month" | "all_time") => {
    setTimeFrame(newTimeframe);
  };

  const handleGenerateAdvice = async (customPrompt?: string) => {
    if (userId) {
      await generateAdvice(userId, customPrompt);
    }
  };

  const getHealthScoreColor = (score?: number) => {
    if (!score) return "text-gray-600 bg-gray-100";
    if (score >= 70) return "text-green-600 bg-green-100";
    if (score >= 50) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  const getHealthScoreLabel = (score?: number) => {
    if (!score) return "Not Available";
    if (score >= 70) return "Excellent";
    if (score >= 50) return "Good";
    if (score >= 30) return "Fair";
    return "Needs Improvement";
  };

  const metrics = summary
    ? [
        {
          title: "Total Income",
          value: formatCurrency(summary.total_income),
          icon: TrendingUp,
          color: "text-green-600",
          bgColor: "bg-green-50",
        },
        {
          title: "Total Expenses",
          value: formatCurrency(summary.total_expenses),
          icon: TrendingDown,
          color: "text-red-600",
          bgColor: "bg-red-50",
        },
        {
          title: "Net Savings",
          value: formatCurrency(summary.net_savings),
          icon: DollarSign,
          color: "text-blue-600",
          bgColor: "bg-blue-50",
        },
        {
          title: "Savings Rate",
          value: formatPercentage(summary.savings_rate),
          icon: Target,
          color: "text-purple-600",
          bgColor: "bg-purple-50",
        },
        {
          title: "Financial Health",
          value: summary.financial_health_score
            ? `${summary.financial_health_score}/100`
            : "N/A",
          icon: Heart,
          color: getHealthScoreColor(summary.financial_health_score).split(
            " "
          )[0],
          bgColor: getHealthScoreColor(summary.financial_health_score).split(
            " "
          )[1],
          subtext: getHealthScoreLabel(summary.financial_health_score),
        },
      ]
    : [];

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Financial Analysis
              </h1>
              <p className="text-gray-600 mt-2">
                Chart Analysis and your spending percentage in general
              </p>
            </div>
            <div className="flex space-x-2">
              <Button
                variant={timeframe === "latest_month" ? "default" : "outline"}
                onClick={() => handleTimeframeChange("latest_month")}
                disabled={isLoading}
              >
                Current Month
              </Button>
              <Button
                variant={timeframe === "all_time" ? "default" : "outline"}
                onClick={() => handleTimeframeChange("all_time")}
                disabled={isLoading}
              >
                All Time
              </Button>
            </div>
          </div>

          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <p className="text-red-800">{error}</p>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : summary && summary.transaction_count > 0 ? (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {metrics.map((metric, index) => (
                  <Card key={index} className={metric.bgColor}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        {metric.title}
                      </CardTitle>
                      <metric.icon className={`h-4 w-4 ${metric.color}`} />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{metric.value}</div>
                      <p className="text-xs text-gray-600 mt-1">
                        {timeframe === "latest_month"
                          ? "This month"
                          : "All time"}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Top Expense */}
              {summary.top_expense_category !== "None" && (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-gray-900 mb-2">
                      Top Spending Category
                    </h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-lg font-medium text-gray-700">
                          {summary.top_expense_category}
                        </span>
                        <p className="text-sm text-gray-500">
                          Your highest expense category
                        </p>
                      </div>
                      <span className="text-lg font-bold text-red-600">
                        {formatCurrency(summary.top_expense_amount)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Income vs Expenses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <IncomeExpenseChart data={[summary]} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Spending by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CategoryChart data={summary} type="expense" />
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-500 mb-4">
                  No financial data available
                </p>
                <Button>
                  <a href="/dashboard/upload">Upload your first file</a>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Predictive Analysis */}
          <div className="space-y-4 py-5">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Predictive Analysis
                </h1>
                <p className="text-gray-600 mt-2">
                  Predictive Analysis based on your spending pattern and
                  overview of future risk and assessment (Work if Transactions
                  have more than 90 days)
                </p>
              </div>
            </div>
            <PredictiveForm userId={userId} />
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
