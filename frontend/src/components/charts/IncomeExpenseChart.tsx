"use client";

import React, { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { FinancialSummary } from "@/types/financial";
import { useCurrency } from "@/lib/hooks/useCurrency";
import { formatCurrency, formatCompactCurrency } from "@/lib/utils/currency";

interface IncomeExpenseChartProps {
  data: FinancialSummary[];
}

const CustomTooltip = ({
  active,
  payload,
  label,
  currency,
}: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xl">
      <p className="text-sm font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <div
            className="w-3 h-3 rounded-full"
            style={{ background: entry.fill }}
          />
          <span className="text-slate-600">{entry.name}:</span>
          <span
            className={`font-semibold ${
              entry.value < 0 ? "text-rose-600" : "text-slate-900"
            }`}
          >
            {formatCurrency(Math.abs(entry.value), currency)}
            {entry.value < 0 ? " (negative)" : ""}
          </span>
        </div>
      ))}
    </div>
  );
};

export const IncomeExpenseChart: React.FC<IncomeExpenseChartProps> = ({
  data,
}) => {
  const { currency } = useCurrency();
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const chartData = data.map((d) => ({
    name: d.timeframe === "latest_month" ? "This Month" : "all_time",
    Income: d.total_income,
    Expenses: d.total_expenses,
    "Net Savings": d.net_savings,
  }));

  // Compute Y-axis domain to always include 0 and handle negatives
  const allValues = chartData.flatMap((d) => [
    hiddenSeries.has("Income") ? 0 : d.Income,
    hiddenSeries.has("Expenses") ? 0 : d.Expenses,
    hiddenSeries.has("Net Savings") ? 0 : d["Net Savings"],
  ]);
  const minVal = Math.min(0, ...allValues);
  const maxVal = Math.max(0, ...allValues);
  const padding = (maxVal - minVal) * 0.15 || maxVal * 0.15 || 100;
  const yMin = minVal < 0 ? minVal - padding : 0;
  const yMax = maxVal + padding;

  const hasNegative = minVal < 0;

  const toggleSeries = (series: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(series)) next.delete(series);
      else next.add(series);
      return next;
    });
  };

  const seriesConfig = [
    { key: "Income", color: "#10b981" },
    { key: "Expenses", color: "#f43f5e" },
    { key: "Net Savings", color: "#3b82f6" },
  ];

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {seriesConfig.map(({ key, color }) => {
          const val = chartData[0]?.[key as keyof typeof chartData[0]] as number ?? 0;
          const isNeg = val < 0;
          return (
            <button
              key={key}
              onClick={() => toggleSeries(key)}
              className={`text-left p-3 rounded-xl border-2 transition-all ${
                hiddenSeries.has(key)
                  ? "opacity-40 border-slate-200 bg-slate-50"
                  : "border-transparent bg-slate-50 hover:bg-white hover:shadow-md"
              }`}
            >
              <p className="text-xs text-slate-500 mb-1">{key}</p>
              <p
                className="text-lg font-bold truncate"
                style={{ color: isNeg ? "#f43f5e" : color }}
              >
                {isNeg ? "-" : ""}
                {formatCompactCurrency(Math.abs(val), currency)}
              </p>
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={(v) => formatCompactCurrency(v, currency)}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip
            content={<CustomTooltip currency={currency} />}
            cursor={{ fill: "rgba(148,163,184,0.1)" }}
          />

          {/* Zero reference line — only shown when there are negative values */}
          {hasNegative && (
            <ReferenceLine
              y={0}
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              label={{
                value: "0",
                position: "right",
                fill: "#94a3b8",
                fontSize: 11,
              }}
            />
          )}

          {!hiddenSeries.has("Income") && (
            <Bar
              dataKey="Income"
              fill="#10b981"
              radius={[6, 6, 0, 0]}
              maxBarSize={60}
            />
          )}
          {!hiddenSeries.has("Expenses") && (
            <Bar
              dataKey="Expenses"
              fill="#f43f5e"
              radius={[6, 6, 0, 0]}
              maxBarSize={60}
            />
          )}
          {!hiddenSeries.has("Net Savings") && (
            <Bar
              dataKey="Net Savings"
              fill="#3b82f6"
              radius={[6, 6, 0, 0]}
              maxBarSize={60}
            />
          )}
        </BarChart>
      </ResponsiveContainer>

      <p className="text-xs text-slate-400 text-center">
        💡 Click on the summary cards above to toggle data series
      </p>
    </div>
  );
};