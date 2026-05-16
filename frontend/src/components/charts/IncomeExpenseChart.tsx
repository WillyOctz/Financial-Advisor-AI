"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { FinancialSummary } from "@/types/financial";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { useCurrency } from "@/lib/hooks/useCurrency";
import { formatCurrency } from "@/lib/utils/currency";

interface IncomeExpenseChartProps {
  data: FinancialSummary[];
}

export const IncomeExpenseChart: React.FC<IncomeExpenseChartProps> = ({
  data,
}) => {
  const { currency } = useCurrency();
  const [activeBar, setActiveBar] = useState<string | null>(null);
  const [visibleBars, setVisibleBars] = useState({
    income: true,
    expense: true,
    savings: true,
  });

  const chartData = data.map((summary) => ({
    month: summary.timeframe,
    income: summary.total_income,
    expense: summary.total_expenses,
    savings: summary.net_savings,
  }));

  // calculate totals for summary
  const totals = chartData.reduce(
    (acc, item) => ({
      income: acc.income + item.income,
      expense: acc.expense + item.expense,
      savings: acc.savings + item.savings,
    }),
    { income: 0, expense: 0, savings: 0 },
  );

  // custom animated tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-white p-4 border-2 border-slate-200 rounded-xl shadow-2xl"
        >
          <p className="font-bold text-slate-900 mb-3 text-lg">{label}</p>
          <div className="space-y-2">
            {payload.map((entry: any, index: number) => (
              <motion.div
                key={index}
                className="flex items-center justify-between gap-4"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm font-medium text-slate-600 capitalize">
                    {entry.name}
                  </span>
                </div>
                <span className="font-bold text-slate-900">
                  {formatCurrency(Number(entry.value), currency)}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      );
    }
    return null;
  };

  // custom animated bar with gradient
  const CustomBar = (props: any) => {
    const { fill, x, y, width, height, name } = props;
    const isActive = activeBar === name;

    return (
      <motion.g
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Glow effect when active */}
        {isActive && (
          <rect
            x={x - 2}
            y={y - 2}
            width={width + 4}
            height={height + 4}
            fill={fill}
            opacity={0.3}
            rx={6}
          />
        )}
        {/* Main bar */}
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={fill}
          rx={4}
          className="transition-all cursor-pointer"
          style={{
            filter: isActive ? "brightness(1.1)" : "brightness(1)",
          }}
        />
      </motion.g>
    );
  };

  // Toggle bar visibility
  const toggleBar = (bar: "income" | "expense" | "savings") => {
    setVisibleBars((prev) => ({ ...prev, [bar]: !prev[bar] }));
  };

  if (chartData.length === 0) {
    return (
      <div className="w-full h-80 bg-linear-to-br from-slate-50 to-blue-50 rounded-xl border border-slate-200 flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div
            animate={{
              y: [0, -10, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <DollarSign className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          </motion.div>
          <p className="text-slate-600 font-medium">
            No financial data available
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      className="w-full space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Total income */}
        <motion.div
          className="p-4 rounded-xl bg-linear-to-br from-emerald-50 to-teal-50 border border-emerald-100 cursor-pointer"
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => toggleBar("income")}
          style={{ opacity: visibleBars.income ? 1 : 1.05 }}
        >
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <span className="text-xs text-emerald-600 font-medium">
              Total Income
            </span>
          </div>
          <motion.p
            className="text-2xl font-bold text-emerald-900"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
          >
            {formatCurrency(totals.income, currency)}
          </motion.p>
        </motion.div>

        {/* Total expense */}
        <motion.div
          className="p-4 rounded-xl bg-linear-to-br from-rose-50 to-pink-50 border border-rose-100 cursor-pointer"
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => toggleBar("expense")}
          style={{ opacity: visibleBars.expense ? 1 : 0.5 }}
        >
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="w-5 h-5 text-rose-600" />
            <span className="text-xs text-rose-600 font-medium">
              Total Expenses
            </span>
          </div>
          <motion.p
            className="text-2xl font-bold text-rose-900"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
          >
            {formatCurrency(totals.expense, currency)}
          </motion.p>
        </motion.div>

        {/* Total savings */}
        <motion.div
          className="p-4 rounded-xl bg-linear-to-br from-blue-50 to-cyan-50 border border-blue-100 cursor-pointer"
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => toggleBar("savings")}
          style={{ opacity: visibleBars.savings ? 1 : 0.5 }}
        >
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <span className="text-xs text-blue-600 font-medium">
              Total Savings
            </span>
          </div>
          <motion.p
            className="text-2xl font-bold text-blue-900"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
          >
            {formatCurrency(totals.savings, currency)}
          </motion.p>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="w-full h-80 bg-white rounded-xl border border-slate-200 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            onMouseMove={(state) => {
              if (state && state.activeLabel) {
                setActiveBar(state.activeLabel);
              }
            }}
            onMouseLeave={() => setActiveBar(null)}
          >
            <defs>
              {/* Gradient for income */}
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.8} />
              </linearGradient>
              {/* Gradient for Expense */}
              <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                <stop offset="100%" stopColor="#ec4899" stopOpacity={0.8} />
              </linearGradient>
              {/* Gradient for Savings */}
              <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.8} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e2e8f0"
              opacity={0.5}
            />
            <XAxis
              dataKey="month"
              tick={{ fill: "#64748b", fontSize: 12 }}
              tickLine={{ stroke: "#cbd5e1" }}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 12 }}
              tickLine={{ stroke: "#cbd5e1" }}
              tickFormatter={(value) => formatCurrency(value, currency)}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f1f5f9" }} />

            {/* Animated Bars */}
            {visibleBars.income && (
              <Bar
                dataKey="income"
                fill="url(#incomeGradient)"
                name="Income"
                radius={[8, 8, 0, 0]}
                shape={<CustomBar />}
                animationDuration={1000}
                animationBegin={0}
              />
            )}
            {visibleBars.expense && (
              <Bar
                dataKey="expense"
                fill="url(#expenseGradient)"
                name="Expense"
                radius={[8, 8, 0, 0]}
                shape={<CustomBar />}
                animationDuration={1000}
                animationBegin={200}
              />
            )}
            {visibleBars.savings && (
              <Bar
                dataKey="savings"
                fill="url(#savingsGradient)"
                name="Savings"
                radius={[8, 8, 0, 0]}
                shape={<CustomBar />}
                animationDuration={1000}
                animationBegin={400}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Interactive Legend Hint */}
      <motion.div
        className="text-center text-sm text-slate-500"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <p>💡 Click on the summary cards above to toggle data series</p>
      </motion.div>
    </motion.div>
  );
};
