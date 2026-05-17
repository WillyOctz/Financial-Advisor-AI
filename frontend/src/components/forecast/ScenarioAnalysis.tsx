"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import { ForecastScenario } from "@/types/financial";
import { useCurrency } from "@/lib/hooks/useCurrency";
import { formatCurrency } from "@/lib/utils/currency";
import {
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

interface ScenarioAnalysisProps {
  scenarios: ForecastScenario;
}

// Custom tool tip
const CustomToolTip = ({ active, payload, label, currency }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.93, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="rounded-xl border border-slate-700/60 bg-slate-900/95 backdrop-blur-sm p-4 shadow-2xl min-w-[180px]"
    >
      <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">
        {label}
      </p>
      <div className="space-y-2">
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: entry.color }}
              />
              <span className="text-xs text-slate-400">{entry.name}</span>
            </div>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: entry.color }}
            >
              {formatCurrency(entry.value, currency)}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};
const staggerFast = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };
const slideLeft = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0 },
};

export const ScenarioAnalysis: React.FC<ScenarioAnalysisProps> = ({
  scenarios,
}) => {
  const { currency } = useCurrency();
  const { baseline, optimistic, pessimistic, comparison } = scenarios;

  // Prepare the chart data
  const chartData = baseline.dates.map((date, index) => ({
    date,
    baseline: baseline.values[index],
    optimistic: optimistic.values[index],
    pessimistic: pessimistic.values[index],
  }));

  const avgBaseLine =
    baseline.values.reduce((a, b) => a + b, 0) / baseline.values.length;

  const scenarioCards = [
    {
      label: "Optimistic",
      delta: comparison.optimistic_vs_baseline,
      color: "text-emerald-400",
      ring: "ring-emerald-500/20",
      bg: "from-emerald-500/8 to-teal-500/0",
      border: "border-emerald-500/20",
      dot: "bg-emerald-400",
      icon: TrendingDown,
      note: "Best-case: lower-than-expected expenses",
    },
    {
      label: "Baseline",
      delta: null,
      color: "text-amber-400",
      ring: "ring-amber-500/20",
      bg: "from-amber-500/8 to-orange-500/0",
      border: "border-amber-500/20",
      dot: "bg-amber-400",
      icon: BarChart3,
      note: "Most likely outcome based on historical patterns",
      value: avgBaseLine,
    },
    {
      label: "Pessimistic",
      delta: comparison.pessimistic_vs_baseline,
      color: "text-red-400",
      ring: "ring-red-500/20",
      bg: "from-red-500/8 to-rose-500/0",
      border: "border-red-500/20",
      dot: "bg-red-400",
      icon: TrendingUp,
      note: "Worst-case: higher-than-expected expenses",
    },
  ];

  const actionPlans = [
    {
      label: "If Optimistic",
      color: "text-emerald-400",
      border: "border-emerald-500/20",
      bg: "bg-emerald-500/5",
      dot: "bg-emerald-400",
      actions: [
        "Allocate extra savings to investments",
        "Consider increasing retirement contributions",
        "Explore high-yield savings options",
      ],
    },
    {
      label: "If Baseline",
      color: "text-amber-400",
      border: "border-amber-500/20",
      bg: "bg-amber-500/5",
      dot: "bg-amber-400",
      actions: [
        "Maintain current budget allocations",
        "Continue regular savings plan",
        "Monitor spending vs. forecast monthly",
      ],
    },
    {
      label: "If Pessimistic",
      color: "text-red-400",
      border: "border-red-500/20",
      bg: "bg-red-500/5",
      dot: "bg-red-400",
      actions: [
        "Build emergency fund to cover 6+ months",
        "Identify discretionary expenses to cut if needed",
        "Review insurance coverage and protections",
      ],
    },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={stagger}
      className="space-y-5"
    >
      {/* Scenario Comparison */}
      <motion.div
        variants={fadeUp}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl border border-slate-800/60 bg-slate-900/80 backdrop-blur-sm overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800/60">
          <div className="w-9 h-9 rounded-xl bg-linear-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              Scenario Analysis
            </h3>
            <p className="text-xs text-slate-500">
              Optimistic · Baseline · Pessimistic Projections
            </p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Scenario cards */}
          <motion.div
            variants={staggerFast}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {scenarioCards.map(
              (
                {
                  label,
                  delta,
                  color,
                  ring,
                  bg,
                  border,
                  dot,
                  icon: Icon,
                  note,
                  value,
                },
                i,
              ) => (
                <motion.div
                  key={label}
                  variants={fadeUp}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ scale: 1.02 }}
                  className={`relative overflow-hidden rounded-xl border ${border} bg-linear-to-br ${bg} p-4`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                      {label}
                    </span>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <motion.p
                    className={`text-3xl font-black tabular-nums ${color}`}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      delay: 0.1 * i + 0.2,
                      type: "spring",
                      stiffness: 200,
                    }}
                  >
                    {delta !== undefined && delta !== null
                      ? `${delta > 0 ? "+" : ""}${Math.abs(delta).toFixed(1)}%`
                      : formatCurrency(value ?? 0, currency)}
                  </motion.p>
                  {delta !== null && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      vs. baseline forecast
                    </p>
                  )}
                  {delta === null && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      avg. monthly
                    </p>
                  )}
                  <div
                    className={`mt-3 rounded-lg border ${border} bg-slate-900/40 px-3 py-2`}
                  >
                    <p className={`text-xs ${color}`}>{note}</p>
                  </div>
                </motion.div>
              ),
            )}
          </motion.div>

          {/* Chart */}
          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            {/* Chart Legend */}
            <div className="flex items-center gap-5 mb-4">
              {[
                { color: "#10b981", label: "Optimistic", dash: true },
                { color: "#f59e0b", label: "Baseline", dash: false },
                { color: "#f43f5e", label: "Pessimistic", dash: true },
              ].map(({ color, label, dash }) => (
                <div key={label} className="flex items-center gap-2">
                  <svg width="20" height="10">
                    <line
                      x1="0"
                      y1="5"
                      x2="20"
                      y2="5"
                      stroke={color}
                      strokeWidth="2"
                      strokeDasharray={dash ? "4 3" : undefined}
                    />
                  </svg>
                  <span className="text-xs text-slate-400">{label}</span>
                </div>
              ))}
            </div>

            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 12, left: 8, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1e293b"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="#334155"
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={{ stroke: "#1e293b" }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => formatCurrency(v, currency)}
                    stroke="#334155"
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={72}
                  />
                  <Tooltip
                    content={<CustomToolTip currency={currency} />}
                    cursor={{ stroke: "#334155", strokeWidth: 1 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="optimistic"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="baseline"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ fill: "#f59e0b", r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, stroke: "#0a0d14", strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pessimistic"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Explanation */}
          <motion.div
            variants={fadeUp}
            className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-4 space-y-3"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-4 rounded-full bg-slate-500" />
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                Understanding Scenarios
              </h4>
            </div>
            {[
              {
                dot: "bg-emerald-400",
                label: "Optimistic",
                desc: "Assumes better-than-expected conditions — reduced spending, economic growth",
              },
              {
                dot: "bg-amber-400",
                label: "Baseline",
                desc: "Most likely outcome based on historical patterns and current trends",
              },
              {
                dot: "bg-red-400",
                label: "Pessimistic",
                desc: "Accounts for potential challenges — inflation, unexpected expenses",
              },
            ].map(({ dot, label, desc }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.07 }}
                className="flex items-start gap-3"
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${dot} mt-1.5 shrink-0`}
                />
                <p className="text-xs text-slate-400">
                  <span className="text-slate-300 font-semibold">{label}:</span>
                  {desc}
                </p>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.75 }}
              className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2"
            >
              <p className="text-xs text-amber-400/90">
                <span className="font-semibold">Tip: </span>
                Use pessimistic scenario for emergency fund planning, optimistic
                scenario for investment goals.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* Action Plan */}
      <motion.div
        variants={fadeUp}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl border border-slate-800/60 bg-slate-900/80 backdrop-blur-sm overflow-hidden"
      >
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800/60">
          <div className="w-9 h-9 rounded-xl bg-linear-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/25">
            <AlertCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              Action Plan by Scenario
            </h3>
            <p className="text-xs text-slate-500">
              Steps to take for each outcome
            </p>
          </div>
        </div>

        <motion.div
          variants={staggerFast}
          className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {actionPlans.map(({ label, color, border, bg, dot, actions }, i) => (
            <motion.div
              key={label}
              variants={fadeUp}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className={`rounded-xl border ${border} ${bg} p-4 space-y-3`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-1 h-4 rounded-full ${dot}`} />
                <h4
                  className={`text-xs font-semibold uppercase tracking-widest ${color}`}
                >
                  {label}
                </h4>
              </div>
              <div className="space-y-2">
                {actions.map((action, j) => (
                  <motion.div
                    key={j}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.1 + j * 0.05 }}
                    className="flex items-center gap-2"
                  >
                    <ChevronRight
                      className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${color}`}
                    />
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {action}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
};