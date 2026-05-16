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
import { ForecastResponse } from "@/types/financial";
import { formatDate } from "@/lib/utils/formatters";
import { TrendingUp } from "lucide-react";
import { useCurrency } from "@/lib/hooks/useCurrency";
import { formatCurrency } from "@/lib/utils/currency";

interface ForecastChartProps {
  forecast: ForecastResponse;
  title?: string;
  height?: number;
}

const CustomToolTip = ({ active, payload, label, currency }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="rounded-xl border border-slate-700/60 bg-slate-900/95 backdrop-blur-sm p-4 shadow-2xl shadow-black/40 min-w-[180px]"
    >
      <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">
        {formatDate(label, "long")}
      </p>
      <div className="space-y-2">
        {payload.map((entry: any, i: number) => (
          <div className="flex items-center justify-between gap-4" key={i}>
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

export const ForecastChart: React.FC<ForecastChartProps> = ({
  forecast,
  title = "Expense Forecast",
  height = 400,
}) => {
  const { currency } = useCurrency();
  const chartData = forecast.dates.map((date, index) => ({
    date,
    forecast: forecast.values[index],
    upper_bound: forecast.confidence_upper[index],
    lower_bound: forecast.confidence_lower[index],
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full rounded-2xl border border-slate-800/60 bg-slate-900/80 backdrop-blur-sm p-6"
    >
      {/* Title */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-linear-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          <p className="text-xs text-slate-500">
            {forecast.dates.length} periods · confidence band shown
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mb-4">
        {[
          { color: "#f59e0b", label: "Forecast", dash: false },
          { color: "#10b981", label: "Upper Bound", dash: true },
          { color: "#f43f5e", label: "Lower Bound", dash: true },
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

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 12, left: 8, bottom: 0 }}
          >
            <defs>
              <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.15} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1e293b"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => formatDate(v, "short")}
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
              content={<CustomToolTip />}
              cursor={{ stroke: "#334155", strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="upper_bound"
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              name="Upper Bound"
              connectNulls={true}
            />
            <Line
              type="monotone"
              dataKey="lower_bound"
              stroke="#f43f5e"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              name="Lower Bound"
              connectNulls={true}
            />
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={{ fill: "#f59e0b", strokeWidth: 0, r: 3 }}
              activeDot={{
                r: 6,
                fill: "#f59e0b",
                stroke: "#0a0d14",
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};
