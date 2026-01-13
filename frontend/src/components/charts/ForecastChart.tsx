"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
} from "recharts";
import { ForecastResponse } from "@/types/financial";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

interface ForecastChartProps {
  forecast: ForecastResponse;
  title?: string;
  height?: number;
}

export const ForecastChart: React.FC<ForecastChartProps> = ({
  forecast,
  title = "Expense Forecast",
  height = 400,
}) => {
  const chartData = forecast.dates.map((date, index) => ({
    date,
    forecast: forecast.values[index],
    upper: forecast.confidence_upper[index],
    lower: forecast.confidence_lower[index],
  }));

  const CustomToolTip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-300 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-800">
            {formatDate(label, "long")}
          </p>
          <p className="text-blue-600">
            Forecast: {formatCurrency(payload[0].value)}
          </p>
          <p className="text-green-600 text-sm">
            Upper: {formatCurrency(payload[1].value)}
          </p>
          <p className="text-red-600 text-sm">
            Lower: {formatCurrency(payload[2].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div style={{ height: `${height}px`, minHeight: '400px' }}>
        <ResponsiveContainer height="100%" width="100%" minHeight={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => formatDate(value, "short")}
              stroke="#6b7280"
              fontSize={12}
            />
            <YAxis
              tickFormatter={(value) => formatCurrency(value)}
              stroke="#6b7280"
              fontSize={12}
            />
            <Tooltip content={<CustomToolTip />} />
            <Legend />

            {/* Confidence interval area */}
            <Area
              type="monotone"
              dataKey="upper"
              stroke="transparent"
              fill="#10b981"
              fillOpacity={0.1}
            />
            <Area
              type="monotone"
              dataKey="lower"
              stroke="transparent"
              fill="#ef4444"
              fillOpacity={0.1}
            />

            {/* Main forecast line */}
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: "#1d4ed8" }}
              name="Forecast"
            />

            {/* Confidence bounds */}
            <Line
              type="monotone"
              dataKey="upper"
              stroke="#10b981"
              strokeWidth={1}
              strokeDasharray="3 3"
              name="Upper Bound"
            />
            <Line
              type="monotone"
              dataKey="lower"
              stroke="#ef4444"
              strokeWidth={1}
              strokeDasharray="3 3"
              name="Lower Bound"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
