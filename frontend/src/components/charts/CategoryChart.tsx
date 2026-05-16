"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Sector,
} from "recharts";
import { FinancialSummary } from "@/types/financial";
import { formatCurrency } from "@/lib/utils/currency";
import { useCurrency } from "@/lib/hooks/useCurrency";
import { format } from "path";
import { Value } from "@radix-ui/react-select";

interface CategoryChartProps {
  data: FinancialSummary;
  type?: "expense" | "income";
  height?: number;
}

const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
];

// Active sector shape for variant of hover effects
const renderActiveShape = (props: any) => {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    percent,
    value,
    currency,
  } = props;

  return (
    <g>
      {/* Expanded sector */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      {/* Glow effect */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 12}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.3}
      />
      {/* Value display */}
      <text
        x={cx}
        y={cy - 20}
        textAnchor="middle"
        fill={fill}
        className="font-bold text-lg"
      >
        {payload.name}
      </text>
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        fill="#334155"
        className="font-bold text-2xl"
      >
        {formatCurrency(value, currency, { showSymbol: true })}
      </text>
      <text
        x={cx}
        y={cy + 25}
        textAnchor="middle"
        fill="#64748b"
        className="text-sm"
      >
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    </g>
  );
};

export const CategoryChart: React.FC<CategoryChartProps> = ({
  data,
  type = "expense",
  height = 350,
}) => {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const [mounted, setMounted] = useState(false);
  const { currency } = useCurrency();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const chartData = Object.entries(data.expense_breakdown || {}).map(
    ([name, value]) => ({
      name,
      value,
    }),
  );

  const CustomToolTip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const percent = (payload[0].value / data.total_expenses) * 100;

      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-white p-4 border-2 border-slate-200 rounded-xl shadow-2xl"
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: payload[0].fill }}
            />
            <p className="font-semibold text-slate-900">{payload[0].name}</p>
          </div>
          <p className="text-2xl font-bold text-blue-600 mb-1">
            {formatCurrency(payload[0].value, currency)}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
              <motion.div
                className="h-full bg-blue-600 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span className="text-sm font-medium text-slate-600">
              {percent.toFixed(1)}%
            </span>
          </div>
        </motion.div>
      );
    }
    return null;
  };

  // Custom legend with hover effects
  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="grid grid-cols-2 gap-2 mt-6">
        {payload.map((entry: any, index: number) => (
          <motion.div
            key={`legend-${index}`}
            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
              activeIndex === index
                ? "bg-blue-50 shadow-md"
                : "hover:bg-slate-50"
            }`}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(undefined)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
              animate={{
                scale: activeIndex === index ? 1.3 : 1,
              }}
            />
            <span className="text-sm text-slate-700 truncate">
              {entry.value}
            </span>
          </motion.div>
        ))}
      </div>
    );
  };

  if (chartData.length === 0) {
    return (
      <div className="w-full bg-linear-to-r from-slate-50 to-blue-50 rounded-xl border border-slate-200 p-8">
        <motion.div
          className="flex flex-col items-center justify-center h-64"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div
            animate={{
              rotate: 360,
              scale: [1, 1.2, 1],
            }}
            transition={{
              rotate: { duration: 3, repeat: Infinity, ease: "linear" },
              scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
            }}
            className="w-20 h-20 bg-linear-to-br from-blue-400 to-cyan-400 rounded-full flex items-center justify-center mb-4"
          >
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
              />
            </svg>
          </motion.div>
          <p className="text-slate-600 font-medium text-lg">
            No {type} data available
          </p>
          <p className="text-slate-500 text-sm mt-2">
            Upload transactions to see the breakdown
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              paddingAngle={2}
              innerRadius={0}
              outerRadius={75}
              fill="#8884d8"
              dataKey="value"
              activeShape={(props: any) =>
                renderActiveShape({ ...props, currency })
              }
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(undefined)}
              animationBegin={0}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  className="cursor-pointer transition-all hover:opacity-80"
                  opacity={
                    activeIndex !== undefined && activeIndex !== index ? 0.6 : 1
                  }
                />
              ))}
            </Pie>
            <Tooltip content={<CustomToolTip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Charts */}
      <motion.div
        className="mt-6 grid grid-cols-2 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="p-4 bg-linear-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
          <p className="text-xs text-blue-600 font-medium mb-1">
            Total Categories
          </p>
          <motion.p
            className="text-2xl font-bold text-blue-900"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, type: "spring" }}
          >
            {chartData.length}
          </motion.p>
        </div>
        <div className="p-4 bg-linear-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
          <p className="text-xs text-purple-600 font-medium mb-1">
            Largest Category
          </p>
          <motion.p
            className="text-lg font-bold text-purple-900 truncate"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
          >
            {chartData.length > 0
              ? chartData.reduce((max, item) =>
                  item.value > max.value ? item : max,
                ).name
              : "N/A"}
          </motion.p>
        </div>
      </motion.div>
    </motion.div>
  );
};
