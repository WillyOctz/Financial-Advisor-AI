"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAnalysis } from "@/lib/hooks/useAnalysis";
import { IncomeExpenseChart } from "@/components/charts/IncomeExpenseChart";
import { CategoryChart } from "@/components/charts/CategoryChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercentage } from "@/lib/utils/formatters";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Sparkles,
  BarChart3,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Upload,
} from "lucide-react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useUser } from "@/lib/hooks/useUser";
import { PredictiveForm } from "@/components/forms/PredictiveForm";
import { useCurrency } from "@/lib/hooks/useCurrency";
import { formatCurrency } from "@/lib/utils/currency";
import { HealthScoreCard } from "@/components/forms/HealthScoreCardForm";
import { time } from "console";

// animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
} satisfies Variants;

const cardHoverVariants = {
  rest: { scale: 1, y: 0 },
  hover: {
    scale: 1.03,
    y: -8,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 20,
    },
  },
} satisfies Variants;

const shimmerVariants = {
  initial: { backgroundPosition: "-1000px 0" },
  animate: {
    backgroundPosition: "1000px 0",
    transition: {
      duration: 2,
      repeat: -1,
      ease: "linear",
    },
  },
} satisfies Variants;

export default function AnalysisPage() {
  const { summary, analysisSummary, isLoading, error, fetchSummary, fetchAnalysisSummary } = useAnalysis();
  const [timeframe, setTimeFrame] = useState<"latest_month" | "all_time">(
    "latest_month",
  );
  const { user } = useUser();
  const userId = user?.id ? Number(user.id) : 0;
  const [mounted, setMounted] = useState(false);
  const { currency } = useCurrency();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (userId) {
      fetchSummary(userId, timeframe);
    }
  }, [userId, timeframe]);

  useEffect(() => {
    if (userId) {
      fetchAnalysisSummary(userId);
    }
  }, [userId])

  const handleTimeframeChange = (newTimeframe: "latest_month" | "all_time") => {
    setTimeFrame(newTimeframe);
  };

  // helper function analysisChangeMetric into text badge and trend
  const changeLabel = (key: "income" | "expenses" | "net_savings" | "savings_rate") => {
    const c = analysisSummary?.changes[key];
    if (!c) return { text: "—", trend: "up" as const };
    const sign = c.direction === "up" ? "+" : "-";
    return { text: `${sign}${Math.abs(c.pct)}%`, trend: c.direction };
  }

  const expenseChangeTrend = (key: "expenses") => {
    const c = analysisSummary?.changes[key];
    if (!c) return "up" as const;
    return c.direction === "up" ? ("down" as const) : ("up" as const);
  };

  const metrics = summary
    ? [
        {
          title: "Total Income",
          value: formatCurrency(summary.total_income, currency),
          icon: TrendingUp,
          color: "emerald",
          gradient: "from-emerald-500 to-teal-500",
          bgGradient: "from-emerald-50 to-teal-50",
          change: changeLabel("income").text,
          trend: changeLabel("income").trend,
        },
        {
          title: "Total Expenses",
          value: formatCurrency(summary.total_expenses, currency),
          icon: TrendingDown,
          color: "rose",
          gradient: "from-rose-500 to-pink-500",
          bgGradient: "from-rose-50 to-pink-50",
          change: changeLabel("expenses").text,
          trend: expenseChangeTrend("expenses"),
        },
        {
          title: "Net Savings",
          value: formatCurrency(summary.net_savings, currency),
          icon: DollarSign,
          color: "blue",
          gradient: "from-blue-500 to-cyan-500",
          bgGradient: "from-blue-50 to-cyan-50",
          change: changeLabel("net_savings").text,
          trend: changeLabel("net_savings").trend,
        },
        {
          title: "Savings Rate",
          value: formatPercentage(summary.savings_rate),
          icon: Target,
          color: "purple",
          gradient: "from-purple-500 to-pink-500",
          bgGradient: "from-purple-50 to-pink-50",
          change: changeLabel("savings_rate").text,
          trend: changeLabel("savings_rate").trend,
        },
      ]
    : [];

  if (isLoading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="space-y-8">
            {/* Header Skeleton */}
            <div className="animate-pulse">
              <div className="h-10 bg-slate-200 rounded w-1/3 mb-4"></div>
              <div className="h-6 bg-slate-200 rounded-w-1/4"></div>
            </div>

            {/* Metrics Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <motion.div
                  key={i}
                  className="bg-white rounded-2xl p-6 shadow-lg"
                  style={{
                    background:
                      "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)",
                    backgroundSize: "1000px 100%",
                  }}
                  variants={shimmerVariants}
                  initial="initial"
                  animate="animate"
                >
                  <div className="h-32"></div>
                </motion.div>
              ))}
            </div>

            {/* Charts Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl p-6 shadow-lg animate-pulse"
                >
                  <div className="h-64 bg-slate-200 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <motion.div
          className="space-y-8"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          {/* Hero Section */}
          <motion.div
            variants={itemVariants}
            className="relative bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 md:p-12 overflow-hidden shadow-2xl"
          >
            {/* Animated Background Elements */}
            <div className="absolute inset-0 opacity-10">
              <motion.div
                className="absolute top-0 right-0 w-96 h-96 bg-linear-to-br from-blue-400 to-cyan-500 rounded-full blur-3xl"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.5, 0.3],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <motion.div
                className="absolute bottom-0 left-0 w-96 h-96 bg-linear-to-tr from-purple-400 to-pink-500 rounded-full blur-3xl"
                animate={{
                  scale: [1.2, 1, 1.2],
                  opacity: [0.5, 0.3, 0.5],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1,
                }}
              />
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 20,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  >
                    <BarChart3 className="w-6 h-6 text-blue-400" />
                  </motion.div>
                  <span className="text-blue-400 text-sm font-medium tracking-wide uppercase">
                    Financial Intelligence
                  </span>
                </div>

                <h1 className="text-3xl md:text-5xl font-bold text-white mb-3">
                  Analysis Dashboard
                </h1>
                <p className="text-slate-300 text-lg max-w-2xl">
                  Insights of your spending patterns, financial health and
                  future predictions
                </p>
              </div>

              {/* Timeframe Toggle */}
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-2 border border-white/20">
                <motion.button
                  onClick={() => handleTimeframeChange("latest_month")}
                  className={`px-6 py-3 rounded-lg font-medium transition-all ${
                    timeframe === "latest_month"
                      ? "bg-white text-slate-900 shadow-lg"
                      : "text-white hover:bg-white/10"
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Current Month
                </motion.button>
                <motion.button
                  onClick={() => handleTimeframeChange("all_time")}
                  className={`px-6 py-3 rounded-lg font-medium transition-all ${
                    timeframe === "all_time"
                      ? "bg-white text-slate-900 shadow-lg"
                      : "text-white hover:bg-white/10"
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  All Time
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Error State */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-linear-to-r from-rose-50 to-red-50 border-l-4 border-rose-500 rounded-xl p-6 shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="shrink-0">
                    <Activity className="w-6 h-6 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="text-rose-900 font-semibold">
                      Analysis Error
                    </h3>
                    <p className="text-rose-700 text-sm mt-1">{error}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content */}
          <AnimatePresence mode="wait">
            {summary && summary.transaction_count > 0 ? (
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                {/* Financial Health Score - Featured Card */}
                <HealthScoreCard timeframe={timeframe} healthScore={summary?.financial_health_score}/>

                {/* Metrics Grid */}
                <motion.div
                  variants={containerVariants}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                >
                  {metrics.map((metric, index) => (
                    <motion.div
                      key={index}
                      variants={itemVariants}
                      whileHover="hover"
                      initial="rest"
                    >
                      <motion.div
                        variants={cardHoverVariants}
                        className="relative group"
                      >
                        <Card className="border-0 shadow-lg hover:shadow-2xl transition-shadow duration-300 overflow-hidden h-full">
                          {/* Gradient Background */}
                          <div
                            className={`absolute inset-0 bg-linear-to-br ${metric.bgGradient} opacity-50 group-hover:opacity-70 transition-opacity`}
                          />

                          {/* Decorative Corner */}
                          <div className="absolute top-0 right-0 w-32 h-32 opacity-20">
                            <div
                              className={`absolute inset-0 bg-linear-to-br ${metric.gradient} rounded-full blur-2xl`}
                            />
                          </div>

                          <CardContent className="p-6 relative z-10">
                            {/* Icon */}
                            <div className="flex items-start justify-between mb-4">
                              <motion.div
                                className={`p-3 rounded-xl bg-linear-to-br ${metric.gradient} shadow-lg`}
                                whileHover={{ rotate: 360, scale: 1.1 }}
                                transition={{ duration: 0.6 }}
                              >
                                <metric.icon className="w-6 h-6 text-white" />
                              </motion.div>

                              {/* Trend Badge */}
                              <motion.div
                                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                  metric.trend === "up"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-rose-100 text-rose-700"
                                }`}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                              >
                                {metric.trend === "up" ? (
                                  <ArrowUpRight className="w-3 h-3" />
                                ) : (
                                  <ArrowDownRight className="w-3 h-3" />
                                )}
                                {metric.change}
                              </motion.div>
                            </div>

                            {/* Title */}
                            <h3 className="text-sm font-medium text-slate-600 mb-2">
                              {metric.title}
                            </h3>

                            {/* Value */}
                            <motion.div
                              className="text-3xl font-bold text-slate-900 mb-1"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 + 0.2 }}
                            >
                              {metric.value}
                            </motion.div>

                            {/* Subtitle */}
                            <p className="text-xs text-slate-500">
                              {timeframe === "latest_month"
                                ? "This month"
                                : "All time"}
                            </p>
                          </CardContent>

                          {/* Hover Glow */}
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div
                              className={`absolute inset-0 bg-linear-to-br ${metric.gradient} opacity-5`}
                            />
                          </div>
                        </Card>
                      </motion.div>
                    </motion.div>
                  ))}
                </motion.div>

                {/* Top Expense Category */}
                {summary.top_expense_category !== "None" && (
                  <motion.div variants={itemVariants}>
                    <Card className="border-0 shadow-lg bg-linear-to-r from-rose-50 to-pink-50">
                      <CardContent className="p-4 md:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          {/* Left side - Icon and Text */}
                          <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                            <motion.div
                              className="shrink-0 p-3 md:p-4 bg-linear-to-r from-rose-500 to-pink-500 rounded-xl md:rounded-2xl shadow-lg"
                              whileHover={{ rotate: 360, scale: 1.1 }}
                              transition={{ duration: 0.6 }}
                            >
                              <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-white" />
                            </motion.div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm md:text-base font-medium text-slate-600 mb-0.5">
                                Top Spending Category
                              </p>
                              <h3 className="text-lg md:text-2xl font-bold text-slate-900 truncate">
                                {summary.top_expense_category}
                              </h3>
                              <p className="text-xs md:text-sm text-slate-500 line-clamp-1">
                                Your highest expense this month
                              </p>
                            </div>
                          </div>

                          {/* Right side - Amount + CTA */}
                          <motion.div
                            className="flex items-center justify-between sm:flex-col sm:items-end gap-2 sm:gap-1 shrink-0"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                          >
                            <div className="text-2xl md:text-3xl font-bold text-rose-600">
                              {formatCurrency(summary.top_expense_amount, currency)}
                            </div>
                            <p className="text-xs md:text-sm text-rose-500 font-medium whitespace-nowrap">
                              Track this category
                            </p>
                          </motion.div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Charts Grid */}
                <motion.div
                  variants={containerVariants}
                  className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                >
                  <motion.div variants={itemVariants}>
                    <Card className="border-0 shadow-xl hover:shadow-2xl transition-shadow">
                      <CardHeader className="border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <BarChart3 className="w-5 h-5 text-blue-600" />
                          </div>
                          <CardTitle className="text-xl">
                            Income vs Expense
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <IncomeExpenseChart data={[summary]} />
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <Card className="border-0 shadow-xl hover:shadow-2xl transition-shadow">
                      <CardHeader className="border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <Activity className="w-5 h-5 text-purple-600" />
                          </div>
                          <CardTitle className="text-xl">
                            Spending by category
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <CategoryChart data={summary} type="expense" />
                      </CardContent>
                    </Card>
                  </motion.div>
                </motion.div>

                {/* Predictive Analysis Chart */}
                <motion.div variants={itemVariants} className="space-y-7">
                  <Card className="border-0 shadow-2xl overflow-hidden bg-linear-to-br from-gray-200 to-slate-300 py-2">
                    <CardContent className="p-6 space-y-5">
                      <div className="flex flex-col md:flex-row items-center">
                        <h2 className="text-3xl font-bold text-slate-900">
                          Predictive Intelligence
                        </h2>
                      </div>
                      <p className="text-slate-700 text-lg max-w-3xl">
                        AI powered to analyze your spending patterns, risk
                        assessment and future predictions
                        <span className="text-sm text-slate-600 block mt-1">
                          (Requires 90+ days of transaction history)
                        </span>
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
                <PredictiveForm summary={summary} />
              </motion.div>
            ) : (
              // Empty State
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring" }}
              >
                <Card className="border-0 shadow-2xl bg-linear-to-r from-blue-50 to-cyan-50">
                  <CardContent className="p-12 text-center">
                    <motion.div
                      className="relative inline-block mb-6"
                      animate={{ y: [0, -10, 0] }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <div className="absolute inset-0 bg-blue-200 blur-3xl " />
                      <BarChart3 className="w-24 h-24 text-blue-600 relative " />
                    </motion.div>
                    <h3 className="text-3xl font-bold text-slate-900 mb-3">
                      No Financial Data Yet
                    </h3>
                    <p className="text-slate-600 text-lg mb-8 max-w-md mx-auto">
                      Upload your first transaction file to unlock powerful
                      insights and analysis
                    </p>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        className="bg-linear-to-r from-blue-600 to-cyan-600 text-white px-8 py-6 text-lg rounded-xl shadow-lg hover:shadow-xl"
                        onClick={() =>
                          (window.location.href = "/dashboard/upload")
                        }
                      >
                        <Upload className="w-5 h-5 mr-2" />
                        Upload Your First File
                      </Button>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
