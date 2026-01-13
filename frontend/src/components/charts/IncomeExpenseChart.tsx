"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { FinancialSummary } from "@/types/financial";

interface IncomeExpenseChartProps {
  data: FinancialSummary[];
}

export const IncomeExpenseChart: React.FC<IncomeExpenseChartProps> = ({
  data,
}) => {
  const chartData = data.map((summary) => ({
    month: summary.timeframe,
    income: summary.total_income,
    expense: summary.total_expenses,
    savings: summary.net_savings,
  }));

  return (
    <div className="w-full h-80 min-h-80">
      <ResponsiveContainer width="100%" height="100%" minHeight={320}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip
            formatter={(value) => [`$${Number(value).toLocaleString()}`, ""]}
          />
          <Legend />
          <Bar dataKey="income" fill="#4f46e5" name="Income" />
          <Bar dataKey="expense" fill="#ef4444" name="Expense" />
          <Bar dataKey="savings" fill="#10b981" name="Savings" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
