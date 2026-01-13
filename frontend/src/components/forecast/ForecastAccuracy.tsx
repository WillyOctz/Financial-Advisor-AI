"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3,
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { AccuracyMetrics } from "@/types/financial";

interface ForecastAccuracyProps {
  metrics?: AccuracyMetrics;
}

export const ForecastAccuracy: React.FC<ForecastAccuracyProps> = ({
  metrics,
}) => {
  if (!metrics) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-gray-500">Accuracy metrics not available</p>
        </CardContent>
      </Card>
    );
  }

  const getAccuracyColor = (mape: number) => {
    if (mape < 10) return "text-green-600";
    if (mape < 20) return "text-yellow-600";
    if (mape < 30) return "text-orange-600";
    return "text-red-600";
  };

  const getAccuracyIcon = (mape: number) => {
    if (mape < 10) return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (mape < 20) return <TrendingUp className="h-5 w-5 text-yellow-600" />;
    return <AlertCircle className="h-5 w-5 text-red-600" />;
  };

  const getConfidenceBadgeColor = (confidence: string) => {
    switch (confidence) {
      case "high":
        return "success";
      case "medium":
        return "warning";
      case "low":
        return "destructive";
      default:
        return "default";
    }
  };

  const getAccuracyDescription = (mape: number) => {
    if (mape < 10) return "Excellent accuracy - forecast is highly reliable";
    if (mape < 20) return "Good accuracy - forecast is generally reliable";
    if (mape < 30) return "Fair accuracy - use forecast as guidance only";
    return "Low accuracy - consider collecting more data";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="h-5 w-5 text-blue-600" />
          <span>Forecast Accuracy & Reliability</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Overall Accuracy */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getAccuracyIcon(metrics.mape)}
              <span className="font-medium">Overall Accuracy</span>
            </div>
            <Badge variant={getConfidenceBadgeColor(metrics.confidence)}>
              {metrics.confidence.toUpperCase()} CONFIDENCE
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span
                className={`font-semibold ${getAccuracyColor(metrics.mape)}`}
              >
                Mean Absolute Percentage Error: {metrics.mape.toFixed(2)}%
              </span>
              <span className="text-gray-600">{metrics.interpretation}</span>
            </div>
            <Progress
              value={100 - Math.min(metrics.mape, 100)}
              className="h-2"
            />
            <p className="text-sm text-gray-600">
              {getAccuracyDescription(metrics.mape)}
            </p>
          </div>
        </div>

        {/* Detailed Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center space-x-2 mb-1">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-700">MAE</span>
            </div>
            <div className="text-lg font-bold">${metrics.mae.toFixed(2)}</div>
            <p className="text-xs text-gray-500">Mean Absolute Error</p>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center space-x-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-gray-700">RMSE</span>
            </div>
            <div className="text-lg font-bold">${metrics.rmse.toFixed(2)}</div>
            <p className="text-xs text-gray-500">Root Mean Square Error</p>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center space-x-2 mb-1">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium text-gray-700">MDAPE</span>
            </div>
            <div className="text-lg font-bold">{metrics.mdape.toFixed(2)}%</div>
            <p className="text-xs text-gray-500">
              Median Absolute Percentage Error
            </p>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center space-x-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-gray-700">
                Coverage
              </span>
            </div>
            <div className="text-lg font-bold">
              {metrics.coverage.toFixed(1)}%
            </div>
            <p className="text-xs text-gray-500">Confidence Coverage</p>
          </div>
        </div>

        {/* Accuracy Interpretation Guide */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-semibold text-blue-800 mb-2">
            Understanding Accuracy Metrics
          </h4>
          <ul className="space-y-2 text-sm text-blue-700">
            <li className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5"></div>
              <span>
                <strong>MAE &lt; 10%</strong> Forecast is highly accurate and
                realiable for planning
              </span>
            </li>
            <li className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-1.5"></div>
              <span>
                <strong>MAE 10%-20%:</strong> Good accuracy, suitable for
                general budget planning
              </span>
            </li>
            <li className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full mt-1.5"></div>
              <span>
                <strong>MAE 20%-30%:</strong> Use forecast as guidance please,
                not precise planning
              </span>
            </li>
            <li className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5"></div>
              <span>
                <strong>MAE &gt; 30%:</strong> Low accuracy, consider collecting
                more historical data
              </span>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
