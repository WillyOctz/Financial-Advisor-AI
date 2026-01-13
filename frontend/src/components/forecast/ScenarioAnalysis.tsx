"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ForecastScenario } from "@/types/financial";
import { formatCurrency } from "@/lib/utils/formatters";
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Target,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ScenarioAnalysisProps {
  scenarios: ForecastScenario;
}

export const ScenarioAnalysis: React.FC<ScenarioAnalysisProps> = ({
  scenarios,
}) => {
  const { baseline, optimistic, pessimistic, comparison } = scenarios;

  // Prepare the chart data
  const chartData = baseline.dates.map((date, index) => ({
    date,
    baseline: baseline.values[index],
    optimistic: optimistic.values[index],
    pessimistic: pessimistic.values[index],
  }));

  // Format Y-Axis tick values
  const formatYAxis = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}k`;
    }
    return `$${value.toFixed(0)}`;
  };

  // Custom tool tip
  const CustomToolTip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-300 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-800">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.dataKey}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Custom legend
  const renderLegend = (props: any) => {
    const { payload } = props;

    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {payload.map((entry: any, index: number) => (
          <div key={`legend-${index}`} className="flex items-center space-x-2">
            <div
              className="w-4 h-0.5"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-gray-700">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Scenario comparison card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-blue-600" />
            <span>Scenario Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card className="border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-green-700">
                    Optimistic Scenario
                  </h4>
                  <TrendingDown className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-green-600">
                  {comparison.optimistic_vs_baseline < 0 ? "-" : "+"}
                  {Math.abs(comparison.optimistic_vs_baseline).toFixed(1)}%
                </p>
                <p className="text-sm text-gray-600">vs. baseline forecast</p>
                <div className="mt-3 p-2 bg-green-50 rounded">
                  <p className="text-sm text-green-700">
                    Best-case scenario: expenses could be{" "}
                    {Math.abs(comparison.optimistic_vs_baseline).toFixed(1)}%
                    lower than expected
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-blue-700">
                    Baseline Forecast
                  </h4>
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  $
                  {(
                    baseline.values.reduce((a, b) => a + b, 0) /
                    baseline.values.length
                  ).toFixed(2)}
                </p>
                <p className="text-sm text-gray-600">Average monthly</p>
                <div className="mt-3 p-2 bg-blue-50 rounded">
                  <p className="text-sm text-blue-700">
                    Most likely scenario based on historical patterns
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-red-700">
                    Pessimistic Scenario
                  </h4>
                  <TrendingUp className="h-5 w-5 text-red-600" />
                </div>
                <p className="text-2xl font-bold text-red-600">
                  {comparison.pessimistic_vs_baseline > 0 ? "+" : "-"}
                  {Math.abs(comparison.pessimistic_vs_baseline).toFixed(1)}%
                </p>
                <p className="text-sm text-gray-600">vs. baseline forecast</p>
                <div className="mt-3 p-2 bg-red-50 rounded">
                  <p className="text-sm text-red-700">
                    Worst-case scenario: expenses could be{" "}
                    {Math.abs(comparison.pessimistic_vs_baseline).toFixed(1)}%
                    higher than expected
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Scenario Chart */}
          <div className="h-[450px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 35, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" />
                <YAxis
                  tickFormatter={(value) => formatCurrency(value)}
                  width={60}
                />
                <Tooltip content={<CustomToolTip />} />
                <Legend content={renderLegend}/>
                <Line
                  type="monotone"
                  dataKey="optimistic"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Optimistic"
                />
                <Line
                  type="monotone"
                  dataKey="baseline"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  name="Baseline"
                />
                <Line
                  type="monotone"
                  dataKey="pessimistic"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Pessimistic"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Scenario Explanation */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">
              Understanding the Scenarios
            </h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5"></div>
                <span>
                  <strong>Optimistic:</strong> Assumes better-than-expected
                  conditions (e.g., reduced spending, economic growth)
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
                <span>
                  <strong>Baseline:</strong> Most likely outcome based on
                  historical patterns and current trends
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5"></div>
                <span>
                  <strong>Pessimistic:</strong> Accounts for potential
                  challenges (e.g., inflation, unexpected expenses)
                </span>
              </li>
            </ul>
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Use pessimistic scenario for emergency
                fund planning and optimistic scenario for investment/savings
                goals.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action plan card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <span>Action Based Plan on Scenarios</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2">
                For Optimistic Scenario
              </h4>
              <ul className="space-y-1 text-sm text-blue-700">
                <li>• Allocate extra savings to investments</li>
                <li>• Consider increasing retirement contributions</li>
                <li>• Explore high-yield savings options</li>
              </ul>
            </div>

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-2">
                For Baseline Scenario
              </h4>
              <ul className="space-y-1 text-sm text-green-700">
                <li>• Maintain current budget allocations</li>
                <li>• Continue regular savings plan</li>
                <li>• Monitor spending vs. forecast monthly</li>
              </ul>
            </div>

            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="font-semibold text-red-800 mb-2">
                For Pessimistic Scenario
              </h4>
              <ul className="space-y-1 text-sm text-red-700">
                <li>• Build emergency fund to cover 6+ months</li>
                <li>• Identify discretionary expenses to cut if needed</li>
                <li>• Review insurance coverage and protections</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
