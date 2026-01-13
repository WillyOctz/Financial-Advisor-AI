"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Info,
  CheckCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ForecastInsight {
  type: "info" | "warning" | "positive";
  title: string;
  description: string;
  details: string;
  action: string;
}

interface ForecastInsightsProps {
  insights?: ForecastInsight[];
}

export const ForecastInsights: React.FC<ForecastInsightsProps> = ({
  insights,
}) => {
  if (!insights || insights.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-gray-500">No insights generated yet.</p>
        </CardContent>
      </Card>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "warning":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case "positive":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      default:
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case "warning":
        return "bg-red-100 text-red-800 border-red-200";
      case "positive":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          <span>Key Forecast Insights</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {insights.map((insight, index) => (
            <div
              className="p-4 border rounded-lg hover:shadow-sm transition-shadow"
              key={index}
            >
              <div className="flex items-start space-x-3">
                <div className="shrink-0 mt-1">{getIcon(insight.type)}</div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">
                      {insight.title}
                    </h4>
                    <Badge className={getBadgeColor(insight.type)}>
                      {insight.type.charAt(0).toUpperCase() +
                        insight.type.slice(1)}
                    </Badge>
                  </div>
                  <p className="text-gray-700">{insight.description}</p>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="text-sm text-gray-600">{insight.details}</p>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="font-medium text-gray-700">Action:</span>
                    <span className="text-gray-600">{insight.action}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
