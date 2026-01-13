"use client";

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  DollarSign,
  TrendingUp,
  Loader2,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { useUser } from "@/lib/hooks/useUser";
import { apiClient } from "@/lib/api/client";
import ProtectedRoute from "@/components/ProtectedRoute";

interface FinancialMetrics {
  total_income: number;
  total_expenses: number;
  net_savings: number;
  savings_rate: number;
  top_expense_categories: string;
  top_expense_amount: number;
  transaction_count: number;
  timeframe: string;
}

interface DailySummary extends FinancialMetrics {
  date: string;
}

export default function DashboardPage() {
  const { user } = useUser();
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTodaySummary = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);
        // Fetch today's summary from API
        const res = await apiClient.get(`/display/summary/${user.id}`, {
          params: {
            timeframe: "today",
          },
        });
        setDailySummary(res.data);
      } catch (err: any) {
        console.error("Error fetching today's summary:", err);
        setError(
          err.response?.data?.detail || "Failed to load today's financial data"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTodaySummary();
  }, [user?.id]);

  const displayMetrics = dailySummary
    ? [
        {
          title: "Today's Income",
          value: `$${dailySummary?.total_income.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
          change: "+0.0%",
          icon: ArrowUpIcon,
          color: "text-green-600",
        },
        {
          title: "Today's Expenses",
          value: `$${dailySummary?.total_expenses.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
          change: "+0.0%",
          icon: ArrowDownIcon,
          color: "text-red-600",
        },
        {
          title: "Net Savings",
          value: `$${dailySummary?.net_savings.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
          change: dailySummary?.savings_rate
            ? `+${dailySummary.savings_rate.toFixed(2)}%`
            : "+0.0%",
          icon: DollarSign,
          color: "text-blue-600",
        },
        {
          title: "Savings Rate",
          value: `${dailySummary?.savings_rate.toFixed(2)}%`,
          change: "+5.4%",
          icon: TrendingUp,
          color: "text-purple-600",
        },
      ]
    : [];

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="text-gray-600">
              Loading today's financial data...
            </span>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <div className="text-center">
              <p className="text-red-600 font-medium mb-2">{error}</p>
              <p className="text-gray-500 text-sm">
                Try refreshing the page or check your connection
              </p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome, {user?.first_name} {user?.last_name}!
              </h1>
              <p className="text-gray-600 mt-2">
                Overview Of your financial insights
              </p>
            </div>
            <div className="flex items-center space-x-2 text-gray-500">
              <Calendar className="w-5 h-5" />
              <span className="text-sm font-medium">{today}</span>
            </div>
          </div>

          {/* Financial Metrics */}
          {dailySummary && dailySummary.transaction_count > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {displayMetrics.map((metric, index) => (
                  <Card key={index} className={`border-0 bg-gray-100`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        {metric.title}
                      </CardTitle>
                      <metric.icon className={`h-4 w-4 ${metric.color}`} />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{metric.value}</div>
                      <p className="text-xs text-gray-600 mt-1">
                        {metric.title.includes("Savings Rate") ? (
                          `Today's Rate`
                        ) : (
                          <>
                            <span className={metric.color}>
                              {metric.change}
                            </span>{" "}
                            from yesterday
                          </>
                        )}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Transaction Summary */}
              <Card>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">
                        Transaction Today
                      </h3>
                      <p className="text-2xl font-bold text-gray-900">
                        {dailySummary.transaction_count}
                      </p>
                    </div>
                    {dailySummary.top_expense_categories !== "None" && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-1">
                          Top Expense
                        </h3>
                        <div>
                          <p className="text-lg font-semibold text-gray-900">
                            {dailySummary.top_expense_categories}
                          </p>
                          <p className="text-sm text-red-600">
                            $
                            {dailySummary.top_expense_amount.toLocaleString(
                              "en-US",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-1">
                        Date Range
                      </h3>
                      <p className="text-lg font-semibold text-gray-900">
                        Today
                      </p>
                      <p className="text-sm text-gray-500">
                        {dailySummary.timeframe}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-yellow-900 mb-2">
                  No Transactions Today
                </h3>
                <p className="text-yellow-700 mb-4">
                  You haven't recorded any transactions for today. Start
                  tracking your finances!
                </p>
                <div className="flex gap-4 justify-center">
                  <a
                    href="/dashboard/upload"
                    className="inline-block bg-yellow-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-yellow-700"
                  >
                    Upload Today's Transactions
                  </a>
                  <a
                    href="/dashboard/analysis"
                    className="inline-block bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
                  >
                    View Historical Data
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-6">
                <h3 className="font-semibold text-blue-900 mb-2">
                  Upload new data
                </h3>
                <p className="text-blue-700 text-sm mb-4">
                  Upload your latest financial transactions for analysis
                </p>
                <a
                  href="/dashboard/upload"
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Upload File
                </a>
              </CardContent>
            </Card>

            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-6">
                <h3 className="font-semibold text-green-900 mb-2">
                  Display Analysis
                </h3>
                <p className="text-green-700 text-sm mb-4">
                  Get detailed insights into your spending patterns
                </p>
                <a
                  href="/dashboard/analysis"
                  className="inline-block bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700"
                >
                  View Analysis
                </a>
              </CardContent>
            </Card>

            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="p-6">
                <h3 className="font-semibold text-purple-900 mb-2">Forecast</h3>
                <p className="text-purple-700 text-sm mb-4">
                  See future expense predictions and trends
                </p>
                <a
                  href="/dashboard/forecast"
                  className="inline-block bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-700"
                >
                  View Forecast
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
