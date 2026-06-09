"use client";

import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  DollarSign,
  TrendingUp,
  Loader2,
  AlertCircle,
  Calendar,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { useUser } from "@/lib/hooks/useUser";
import { apiClient } from "@/lib/api/client";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useCurrency } from "@/lib/hooks/useCurrency";
import { formatCurrency } from "@/lib/utils/currency";

interface FinancialMetrics {
  total_income: number;
  total_expenses: number;
  net_savings: number;
  savings_rate: number;
  top_expense_category: string;
  top_expense_amount: number;
  transaction_count: number;
  timeframe: string;
  display_timeframe: "today" | "latest_month";
}

interface DailySummary extends FinancialMetrics {
  date: string;
}

export default function DashboardPage() {
  const { user } = useUser();
  const { currency } = useCurrency();
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchTodaySummary = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);
        // Fetch today's summary from API
        const res = await apiClient.get(`/display/dashboard/${user.id}`, {
          params: {
            timeframe: "today",
          },
        });
        setDailySummary(res.data);
      } catch (err: any) {
        console.error("Error fetching today's summary:", err);
        setError(
          err.response?.data?.detail || "Failed to load today's financial data",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTodaySummary();
  }, [user?.id]);

  const isToday = dailySummary?.display_timeframe == "today";

  const displayMetrics = dailySummary
    ? [
        {
          title: isToday ? "Today's Income" : "Monthly Income",
          value: dailySummary.total_income,
          change: null,
          icon: ArrowUpIcon,
          color: "emerald",
          bgGradient: "from-emerald-50 to-teal-50",
          iconBg: "bg-emerald-100",
          iconColor: "text-emerald-600",
          trend: "up",
        },
        {
          title: isToday ? "Today's Expenses" : "Monthly Expenses",
          value: dailySummary.total_expenses,
          change: null,
          icon: ArrowDownIcon,
          color: "rose",
          bgGradient: "from-rose-50 to-pink-50",
          iconBg: "bg-rose-100",
          iconColor: "text-rose-600",
          trend: "down",
        },
        {
          title: "Net Savings",
          value: dailySummary.net_savings,
          change: null,
          icon: DollarSign,
          color: "blue",
          bgGradient: "from-blue-50 to-indigo-50",
          iconBg: "bg-blue-100",
          iconColor: "text-blue-600",
          trend: "neutral",
        },
        {
          title: "Savings Rate",
          value: dailySummary.savings_rate,
          change: null,
          icon: TrendingUp,
          color: "amber",
          bgGradient: "from-amber-50 to-yellow-50",
          iconBg: "bg-amber-100",
          iconColor: "text-amber-600",
          trend: "up",
          isPercentage: true,
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
          <div className="space-y-8 animate-pulse">
            {/* Hero Skeleton Layout */}
            <div className="bg-linear-to-br from-slate-50 to-slate-100 rounded-2xl p-8 border- border-slate-200">
              <div className="h-10 bg-slate-200 rounded w-1/3 mb-4"></div>
              <div className="h-6 bg-slate-200 rounded w-1/4"></div>
            </div>

            {/* Metrics Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl p-6 border border-slate-200 h-40"
                >
                  <div className="h-4 bg-slate-200 rounded w-2/3 mb-4"></div>
                  <div className="h-8 bg-slate-200 rounded w-full mb-2"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-fade-in">
            <div className="relative">
              <div className="absolute inset-0 bg-red-100 blur-3xl opacity-50 rounded-full"></div>
              <AlertCircle className="w-20 h-20 text-red-500 relative" />
            </div>
            <div className="text-center max-w-md">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">
                Unable to load data
              </h3>
              <p className="text-slate-600 mb-1">{error}</p>
              <p className="text-sm text-slate-500">
                Try refreshing the page or check your network
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
        <div className="space-y-8">
          {/* Hero section (animation) */}
          <div
            className={`bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-8 md:p-12 border border-slate-700 shadow-2xl relative overflow-hidden transition-all duration-700 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            {/* Animated background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-96 h-96 bg-linear-to-br from-amber-400 to-orange-500 rounded-full blur-3xl animate-pulse"></div>
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-linear-to-tr from-blue-400 to-cyan-500 rounded-full blur-3xl animate-pulse delay-1000"></div>
            </div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                  <span className="text-amber-400 text-sm font-medium tracking-wide uppercase">
                    Financial Overview
                  </span>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                  Welcome back, {user?.first_name}
                </h1>
                <p className="text-slate-300 text-lg">
                  Today's financial snapshot
                </p>
              </div>

              <div className="flex items-center gap-3 px-5 py-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                <Calendar className="w-5 h-5 text-amber-400" />
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">
                    Today
                  </p>
                  <p className="text-white font-medium">{today}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Financial metrics with staggered animation */}
          {dailySummary && dailySummary.transaction_count > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {displayMetrics.map((metric, index) => (
                  <div
                    key={index}
                    className={`group transition-all duration-500 ${
                      mounted
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-8"
                    }`}
                    style={{ transitionDelay: `${index * 100}ms` }}
                  >
                    <Card className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 bg-white overflow-hidden relative">
                      {/* Gradient Background */}
                      <div
                        className={`absolute inset-0 bg-linear-to-br ${metric.bgGradient} opacity-50 group-hover:opacity-70 transition-opacity`}
                      ></div>
                      <CardContent className="p-6 relative z-10">
                        {/* Icon */}
                        <div className="flex items-start justify-between mb-4">
                          <div
                            className={`${metric.iconBg} p-3 rounded-xl group-hover:scale-110 transition-transform duration-300`}
                          >
                            <metric.icon
                              className={`h-6 w-6 ${metric.iconColor}`}
                            />
                          </div>
                          {metric.trend !== "neutral" && (
                            <div
                              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                metric.trend === "up"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-rose-100 text-rose-700"
                              }`}
                            >
                              {metric.trend === "up" ? "↑" : "↓"}{" "}
                              {metric.change}
                            </div>
                          )}
                        </div>

                        {/* Title */}
                        <h3 className="text-sm font-medium text-slate-600 mb-2">
                          {metric.title}
                        </h3>

                        {/* Value */}
                        <div className="text-3xl font-bold text-slate-900 mb-1">
                          {metric.isPercentage ? (
                            `${metric.value.toFixed(2)}%`
                          ) : (
                            <span>
                              {formatCurrency(metric.value, currency)}
                            </span>
                          )}
                        </div>

                        {/* Subtitle */}
                        <p className="text-xs text-slate-500">
                          {metric.title.includes("Savings Rate")
                            ? "Today's Rate"
                            : "vs. yesterday"}
                        </p>
                      </CardContent>

                      {/* Hover Effect Border */}
                      <div className="absolute inset-0 border-2 border-transparent group-hover:border-slate-900/10 rounded-xl transition-colors"></div>
                    </Card>
                  </div>
                ))}
              </div>

              {/* Transaction Summary Card */}
              <Card
                className={`border-0 shadow-lg bg-white transition-all duration-700 ${
                  mounted
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: "400ms" }}
              >
                <CardContent className="p-8">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="h-1 w-12 bg-linear-to-r from-amber-400 to-orange-500 rounded-full"></div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Today's Activity
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">
                        Transactions
                      </p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-4xl font-bold text-slate-900">
                          {dailySummary.transaction_count}
                        </p>
                        <span className="text-slate-500 text-sm">recorded</span>
                      </div>
                    </div>

                    {dailySummary.top_expense_category !== "None" && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">
                          Top Spending
                        </p>
                        <div>
                          <p className="text-xl font-bold text-slate-900 mb-1">
                            {dailySummary.top_expense_category}
                          </p>
                          <p className="text-2xl font-bold text-rose-600">
                            {formatCurrency(dailySummary.top_expense_amount, currency)}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">
                        Period
                      </p>
                      <div>
                        <p className="text-xl font-bold text-slate-900">
                          {isToday ? "Today" : dailySummary.timeframe}
                        </p>
                        <p className="text-sm text-slate-600">
                          {isToday ? dailySummary.date ?? "" : "Latest available data"}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card
              className={`border-0 shadow-lg bg-linear-to-br from-amber-50 to-orange-50 transition-all duration-700 ${
                mounted
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
            >
              <CardContent className="p-12 text-center">
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-amber-200 blur-2xl opacity-50 rounded-full"></div>
                  <AlertCircle className="w-16 h-16 text-amber-600 relative" />
                </div>

                <h3 className="text-2xl font-bold text-slate-900 mb-3">
                  No Transactions yet today
                </h3>
                <p className="text-slate-600 mb-8 max-w-md mx-auto">
                  Start tracking your finances by uploading your transactions
                </p>

                <div className="flex flex-wrap gap-4 justify-center">
                  <a
                    href="/dashboard/upload"
                    className="group inline-flex items-center gap-2 bg-linear-to-r from-amber-500 to-orange-500 text-white px-6 py-3 rounded-xl font-medium hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                  >
                    Upload Transactions
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </a>

                  <a
                    href="/dashboard/analysis"
                    className="inline-flex items-center gap-2 bg-white text-slate-700 px-6 py-3 rounded-xl font-medium hover:shadow-lg border border-slate-200 hover:-translate-y-1 transition-all duration-300"
                  >
                    View History
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Action Grid */}
          <div
            className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-700 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
            style={{ transitionDelay: "500ms" }}
          >
            {[
              {
                title: "Upload New Data",
                description:
                  "Import your latest financial transactions for instant analysis",
                href: "/dashboard/upload",
                icon: "📊",
                gradient: "from-blue-500 to-cyan-500",
                hoverGradient: "hover:from-blue-600 hover:to-cyan-600",
              },
              {
                title: "View Analytics",
                description:
                  "Deep dive into your spending patterns and financial trends",
                href: "/dashboard/analysis",
                icon: "📈",
                gradient: "from-emerald-500 to-teal-500",
                hoverGradient: "hover:from-emerald-600 hover:to-teal-600",
              },
              {
                title: "Future Forecast",
                description:
                  "AI-powered predictions for your upcoming expenses",
                href: "/dashboard/forecast",
                icon: "🔮",
                gradient: "from-purple-500 to-pink-500",
                hoverGradient: "hover:from-purple-600 hover:to-pink-600",
              },
            ].map((action, index) => (
              <a
                key={index}
                href={action.href}
                className="group block"
                style={{ transitionDelay: `${(index + 5) * 100}ms` }}
              >
                <Card className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 bg-white overflow-hidden relative h-full">
                  <div
                    className={`absolute inset-0 bg-linear-to-br ${action.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
                  ></div>
                  <CardContent className="p-6 relative z-10">
                    <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">
                      {action.icon}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-linear-to-r group-hover:from-blue-600 group-hover:to-purple-600 transition-all">
                      {action.title}
                    </h3>
                    <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                      {action.description}
                    </p>
                    <div
                      className={`inline-flex items-center gap-2 text-sm font-medium text-slate-700 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-linear-to-r ${action.gradient}`}
                    >
                      Get Started
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        </div>

        {/* Add Custom Styles */}
        <style jsx>{`
          @keyframes fade-in {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .animate-fade-in {
            animation: fade-in 0.6s ease-out;
          }

          .delay-1000 {
            animation-delay: 1s;
          }
        `}</style>
      </DashboardLayout>
    </ProtectedRoute>
  );
}