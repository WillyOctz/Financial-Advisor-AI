"use client";

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { FinancialSummary } from "@/types/financial";
import { formatCurrency } from "@/lib/utils/formatters";

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

export const CategoryChart: React.FC<CategoryChartProps> = ({
  data,
  type = "expense",
  height = 300,
}) => {
  const chartData = Object.entries(data.expense_breakdown || {}).map(
    ([name, value]) => ({
      name,
      value,
    })
  );

  const CustomToolTip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-sm">
          <p className="font-medium text-gray-900">{payload[0].name}</p>
          <p className="text-blue-600">{payload[0].value}</p>
          <p className="text-gray-600 text-sm">
            {((payload[0].value / data.total_expenses) * 100).toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-500">No {type} data available</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {type === "expense" ? "Expense" : "Income"} by Category
      </h3>
      <div style={{ height: `${height}px ` }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              paddingAngle={8}
              label={({ name, percent }) =>
                `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
              }
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomToolTip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
