"use client";

import React, { useState, useEffect } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useForecast } from "@/lib/hooks/useForecast";
import { useUser } from "@/lib/hooks/useUser";
import { ForecastChart } from "@/components/charts/ForecastChart";
import { ForecastInsights } from "@/components/forecast/ForecastInsights";
import { ForecastAccuracy } from "@/components/forecast/ForecastAccuracy";
import { ScenarioAnalysis } from "@/components/forecast/ScenarioAnalysis";
import { ForecastErrorBoundary } from "@/components/forecast/ForecastErrorBoundary";
import { useCurrency } from "@/lib/hooks/useCurrency";
import { formatCompactCurrency, CURRENCIES } from "@/lib/utils/currency";
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
  Clock,
  DollarSign,
  LineChart as LineChartIcon,
  RefreshCw,
  ChevronRight,
} from "lucide-react";

// -------------------Animation Variants-------------------
const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };
const fadeIn = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const staggerFast = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

// -------------------Animated Counter-------------------
const AnimatedNumber = ({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  currency,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  currency?: "USD" | "IDR";
}) => {
  const mv = useMotionValue(0);

  const display = useTransform(mv, (v) => {
    if (currency) {
      const config = CURRENCIES[currency];
      const convertedValue = currency === "IDR" ? v * 17450 : v;

      return new Intl.NumberFormat(config.locale, {
        style: "currency",
        currency: config.code,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        notation: "compact",
      }).format(convertedValue);
    }
    return `${prefix}${v.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`;
  });

  useEffect(() => {
    const ctrl = animate(mv, value, {
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1],
      delay: 0.3,
    });
    return ctrl.stop;
  }, [value]);
  return <motion.span>{display}</motion.span>;
};

// -------------------Animated Bar-------------------
const AnimatedBar = ({
  value,
  color,
  delay = 0,
}: {
  value: number;
  color: string;
  delay?: number;
}) => {
  const w = useMotionValue(0);
  const wp = useTransform(w, (v) => `${v}%`);
  useEffect(() => {
    const ctrl = animate(w, Math.min(value, 100), {
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1],
      delay,
    });
    return ctrl.stop;
  }, [value]);
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-800/80 overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color}`}
        style={{ width: wp }}
      />
    </div>
  );
};

// -------------------Stat Card-------------------
const StatCard = ({
  label,
  children,
  sub,
  icon: Icon,
  iconGradient,
  delay = 0,
}: {
  label: string;
  children: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ElementType;
  iconGradient: string;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    whileHover={{ scale: 1.02, borderColor: "rgba(245,158,11,0.3)" }}
    className="relative overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/80 backdrop-blur-sm p-5"
  >
    <motion.div
      className="absolute inset-0 bg-linear-to-br from-amber-500/4 to-transparent"
      initial={{ opacity: 0 }}
      whileHover={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    />
    <div className="flex items-start justify-between mb-4">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">
        {label}
      </p>
      <div
        className={`w-9 h-9 rounded-xl bg-linear-to-br ${iconGradient} flex items-center justify-center shadow-lg`}
      >
        <Icon className="w-4.5 h-4.5 text-white" />
      </div>
    </div>
    <div className="text-2xl font-black text-slate-100 tabular-nums">
      {children}
    </div>
    {sub && <div className="mt-1.5">{sub}</div>}
  </motion.div>
);

// -------------------Tab Button--------------------
const TabBtn = ({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) => (
  <motion.button
    onClick={onClick}
    whileTap={{ scale: 0.96 }}
    className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
      active ? "text-slate-100" : "text-slate-500 hover:text-slate-300"
    }`}
  >
    {active && (
      <motion.div
        layoutId="tab-bg"
        className="absolute inset-0 rounded-xl bg-linear-to-r from-amber-500/20 to-orange-500/10 border border-amber-500/30"
        transition={{ type: "spring", stiffness: 280, damping: 28 }}
      />
    )}
    <Icon className="w-4 h-4 relative z-10" />
    <span className="relative z-10">{label}</span>
  </motion.button>
);

// -------------------Page-------------------

export default function ForecastPage() {
  const {
    forecast,
    scenarios,
    isLoading,
    error,
    fetchForecast,
    fetchScenarios,
  } = useForecast();
  const { currency } = useCurrency();
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

  const handleViewMode = (mode: "forecast" | "insights" | "scenarios") => {
    setViewMode(mode);
    if (mode === "scenarios" && userId) fetchScenarios(userId, periods);
  };

  const totalForecast = forecast?.values?.reduce((a, b) => a + b, 0) ?? 0;
  const avgMonthly = forecast?.values
    ? totalForecast / forecast.values.length
    : 0;

  const confidenceBadge =
    forecast?.accuracy_metrics?.confidence === "high"
      ? {
          cls: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
          label: "HIGH",
        }
      : forecast?.accuracy_metrics?.confidence === "medium"
        ? {
            cls: "bg-amber-500/10   text-amber-400   ring-amber-500/30",
            label: "MED",
          }
        : forecast?.accuracy_metrics?.confidence === "low"
          ? {
              cls: "bg-red-500/10     text-red-400     ring-red-500/30",
              label: "LOW",
            }
          : {
              cls: "bg-slate-700       text-slate-400   ring-slate-600",
              label: "N/A",
            };

  const trendValue = forecast?.seasonality_patterns?.trend_strength;
  const trendPct =
    trendValue === "increasing" ? 70 : trendValue === "decreasing" ? 30 : 50;
  const volatility = Math.min(
    (forecast?.seasonality_patterns?.volatility_score ?? 0) * 100,
    100,
  );
  const seasonHigh = !!forecast?.seasonality_patterns?.yearly_seasonality;

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <motion.div
          initial="initial"
          animate="visible"
          variants={stagger}
          className="space-y-5 min-h-screen bg-[#232a3a] px-4 py-2"
        >
          {/* Page Header */}
          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-linear-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl font-black text-slate-100 tracking-tight">
                  AI Forecast
                </h1>
              </div>
              <p className="text-sm text-slate-500 max-w-xl mt-2 pl-1">
                Advanced predictions using machine learning — trend analysis,
                seasonality detection, and confidence intervals.
              </p>
            </div>

            {forecast && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-800/60 bg-slate-900/60 text-xs text-slate-400 shrink-0"
              >
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Last Updated: {new Date().toLocaleDateString()}</span>
              </motion.div>
            )}
          </motion.div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-start gap-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-4"
              >
                <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-red-300 font-semibold text-sm">
                    Forecast Error
                  </p>
                  <p className="text-red-400/70 text-xs mt-0.5">
                    · or you haven't uploaded documents yet.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => userId && fetchForecast(userId, periods)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" /> Retry
                    </button>
                    <a
                      href="/dashboard/upload"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/60 bg-slate-800/60 text-slate-300 text-xs font-medium hover:bg-slate-700/60 transition-colors"
                    >
                      Upload Documents
                    </a>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stat Cards */}
          <AnimatePresence>
            {forecast && (
              <motion.div
                variants={staggerFast}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                <StatCard
                  label="Total Forecasted"
                  icon={DollarSign}
                  iconGradient="from-amber-400 to-orange-500"
                  delay={0}
                >
                  <AnimatedNumber value={totalForecast} currency={currency} />
                  <div className="mt-1 text-xs text-slate-500">
                    Over {periods} months
                  </div>
                </StatCard>

                <StatCard
                  label="Forecast Confidence"
                  icon={Shield}
                  iconGradient="from-violet-500 to-indigo-600"
                  delay={0.08}
                >
                  <span className="text-lg">
                    {forecast.accuracy_metrics?.interpretation ??
                      "Calculating…"}
                  </span>
                  <div className="mt-2">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ring-1 ${confidenceBadge.cls}`}
                    >
                      {confidenceBadge.label} CONFIDENCE
                    </span>
                  </div>
                </StatCard>

                <StatCard
                  label="Data Quality"
                  icon={LineChartIcon}
                  iconGradient="from-blue-500 to-cyan-500"
                  delay={0.16}
                >
                  <AnimatedNumber
                    value={forecast.metadata?.total_transactions ?? 0}
                    suffix=" transactions"
                    decimals={0}
                  />
                  <div className="mt-1 text-xs text-slate-500">
                    {forecast.metadata?.date_range?.days_covered ?? 0} days of
                    history
                  </div>
                </StatCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls Bar */}
          <motion.div
            variants={fadeUp}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-slate-800/60 bg-slate-900/80 backdrop-blur-sm px-5 py-4"
          >
            {/* Periods Selector */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span className="font-medium">Period</span>
              </div>
              <Select
                value={periods.toString()}
                onValueChange={(v) => setPeriods(parseInt(v))}
              >
                <SelectTrigger className="w-32 h-9 rounded-xl border-slate-700/60 bg-slate-800/60 text-slate-200 text-sm focus:ring-amber-500/40 focus:border-amber-500/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-700/60 bg-slate-900 text-slate-200">
                  <SelectItem value="3">3 Months</SelectItem>
                  <SelectItem value="6">6 Months</SelectItem>
                  <SelectItem value="12">12 Months</SelectItem>
                  <SelectItem value="24">24 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tab Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-800/60 border border-slate-700/40">
              <TabBtn
                active={viewMode === "forecast"}
                onClick={() => handleViewMode("forecast")}
                icon={LineChartIcon}
                label="Forecast"
              />
              <TabBtn
                active={viewMode === "insights"}
                onClick={() => handleViewMode("insights")}
                icon={Lightbulb}
                label="Insights"
              />
              <TabBtn
                active={viewMode === "scenarios"}
                onClick={() => handleViewMode("scenarios")}
                icon={Target}
                label="Scenarios"
              />
            </div>
          </motion.div>

          {/* Loading */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="rounded-2xl border border-slate-800/60 bg-slate-900/80 backdrop-blur-sm p-16 text-center space-y-6"
              >
                <div className="relative inline-flex items-center justify-center">
                  <motion.div
                    className="absolute inset-0 rounded-full bg-amber-500/15 blur-xl scale-125"
                    animate={{ opacity: [0.4, 0.9, 0.4] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                  />
                  <div className="relative w-16 h-16 rounded-2xl bg-linear-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl shadow-amber-500/30">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    >
                      <RefreshCw className="w-7 h-7 text-white" />
                    </motion.div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-slate-100">
                    Generating Forecast
                  </h3>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto">
                    Analyzing historical patterns, detecting seasonality, and
                    calculating confidence intervals…
                  </p>
                </div>
                <div className="max-w-xs mx-auto space-y-2">
                  {[
                    { label: "Pattern Recognition", value: 90 },
                    { label: "Seasonality Analysis", value: 65 },
                    { label: "Data Analysis", value: 80 },
                  ].map(({ label, value }, i) => (
                    <div key={label} className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{label}</span>
                        <span>{value}%</span>
                      </div>
                      <AnimatedBar
                        value={value}
                        color="bg-gradient-to-r from-amber-500 to-orange-400"
                        delay={0.2 + i * 0.15}
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content */}
          <AnimatePresence mode="wait">
            {!isLoading && forecast && (
              <motion.div
                key={viewMode}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <ForecastErrorBoundary>
                  {viewMode === "forecast" && (
                    <div className="space-y-5">
                      <ForecastChart forecast={forecast} />

                      {/* Forecast Components */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15, duration: 0.45 }}
                        className="rounded-2xl border border-slate-800/60 bg-slate-900/80 backdrop-blur-sm overflow-hidden"
                      >
                        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800/60">
                          <div className="w-9 h-9 rounded-xl bg-linear-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
                            <BarChart3 className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-slate-100">
                              Forecast Components
                            </h3>
                          </div>
                        </div>
                        <motion.div
                          variants={staggerFast}
                          initial="hidden"
                          animate="visible"
                          className="p-6 space-y-5"
                        >
                          {[
                            {
                              label: "Underlying Trend",
                              value: trendPct,
                              sub: trendValue ?? "Unknown",
                              color:
                                "bg-gradient-to-r from-amber-500 to-orange-400",
                              delay: 0,
                            },
                            {
                              label: "Seasonality Impact",
                              value: seasonHigh ? 80 : 20,
                              sub: seasonHigh ? "High" : "Low",
                              color:
                                "bg-gradient-to-r from-violet-500 to-indigo-400",
                              delay: 0.1,
                            },
                            {
                              label: "Data Volatility",
                              value: volatility,
                              sub: `Score: ${(forecast.seasonality_patterns?.volatility_score ?? 0).toFixed(2)}`,
                              color:
                                volatility > 60
                                  ? "bg-gradient-to-r from-red-500 to-rose-400"
                                  : "bg-gradient-to-r from-emerald-500 to-teal-400",
                              delay: 0.2,
                            },
                          ].map(({ label, value, sub, color, delay }) => (
                            <motion.div
                              key={label}
                              variants={fadeUp}
                              transition={{
                                duration: 0.45,
                                delay,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                              className="space-y-2"
                            >
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-slate-300">
                                  {label}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {sub}
                                </span>
                              </div>
                              <AnimatedBar
                                value={value}
                                color={color}
                                delay={delay + 0.3}
                              />
                            </motion.div>
                          ))}
                        </motion.div>
                      </motion.div>
                    </div>
                  )}

                  {viewMode === "insights" && (
                    <div className="space-y-5">
                      <ForecastInsights insights={forecast.forecast_insights} />
                      <ForecastAccuracy metrics={forecast.accuracy_metrics} />

                      {/* Recommendations */}
                      {forecast.recommendations &&
                        forecast.recommendations.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.45 }}
                            className="rounded-2xl border border-slate-800/60 bg-slate-900/80 backdrop-blur-sm overflow-hidden"
                          >
                            <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800/60">
                              <div className="w-9 h-9 rounded-xl bg-linear-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                                <Target className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <h3 className="text-base font-semibold text-slate-100">
                                  Actionable Recommendations
                                </h3>
                                <p className="text-xs text-slate-500">
                                  {forecast.recommendations.length} steps to
                                  improve your forecast outcome
                                </p>
                              </div>
                            </div>
                            <motion.div
                              variants={staggerFast}
                              initial="hidden"
                              animate="visible"
                              className="p-6 space-y-3"
                            >
                              {forecast.recommendations.map((rec, i) => (
                                <motion.div
                                  key={i}
                                  variants={fadeUp}
                                  transition={{
                                    duration: 0.4,
                                    ease: [0.22, 1, 0.36, 1],
                                  }}
                                  whileHover={{ x: 4 }}
                                  className="flex gap-3 p-3.5 rounded-xl border border-amber-500/15 bg-amber-500/5 hover:border-amber-500/30 transition-colors"
                                >
                                  <span className="shrink-0 w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-bold">
                                    {i + 1}
                                  </span>
                                  <p className="text-sm text-slate-300 leading-relaxed">
                                    {rec}
                                  </p>
                                </motion.div>
                              ))}
                            </motion.div>
                          </motion.div>
                        )}
                    </div>
                  )}

                  {viewMode === "scenarios" && scenarios && (
                    <ScenarioAnalysis scenarios={scenarios} />
                  )}

                  {viewMode === "scenarios" && !scenarios && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="rounded-2xl border border-slate-800/60 bg-slate-900/80 p-12 text-center"
                    >
                      <p className="text-slate-500 text-sm">
                        Loading scenario analysis…
                      </p>
                    </motion.div>
                  )}
                </ForecastErrorBoundary>
              </motion.div>
            )}
          </AnimatePresence>

          {/* How it works */}
          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-2xl border border-slate-800/60 bg-slate-900/80 backdrop-blur-sm overflow-hidden"
          >
            <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800/60">
              <div className="w-9 h-9 rounded-xl bg-linear-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                <Info className="w-5 h-5 text-slate-300" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  How Our Forecasting Works
                </h3>
                <p className="text-xs text-slate-500">Model methodology</p>
              </div>
            </div>

            <motion.div
              variants={staggerFast}
              className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5"
            >
              {[
                {
                  icon: TrendingUp,
                  grad: "from-amber-500 to-orange-500",
                  title: "Trend Analysis",
                  desc: "Identifies long-term patterns in your spending to predict future directions.",
                },
                {
                  icon: BarChart3,
                  grad: "from-violet-500 to-indigo-500",
                  title: "Seasonality Detection",
                  desc: "Finds repeating patterns — weekly, monthly, and yearly — in your expenses.",
                },
                {
                  icon: Shield,
                  grad: "from-blue-500 to-cyan-500",
                  title: "Confidence Intervals",
                  desc: "Shows the range where actual expenses are likely to fall. Requires 3+ months of data to calculate.",
                },
              ].map(({ icon: Icon, grad, title, desc }) => (
                <motion.div
                  key={title}
                  variants={fadeUp}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -3 }}
                  className="space-y-3"
                >
                  <div
                    className={`w-9 h-9 rounded-xl bg-linear-to-br ${grad} flex items-center justify-center shadow-lg`}
                  >
                    <Icon className="w-4.5 h-4.5 text-white" />
                  </div>
                  <h4 className="font-semibold text-slate-200 text-sm">
                    {title}
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {desc}
                  </p>
                </motion.div>
              ))}
            </motion.div>

            <div className="px-6 pb-6">
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <p className="text-xs text-amber-400/90 leading-relaxed">
                  <span className="font-semibold">Important: </span>
                  Forecasts are predictions based on historical patterns and may
                  not account for unexpected life events, economic changes, or
                  unusual circumstances. Always maintain an emergency fund and
                  review your actual spending regularly.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
