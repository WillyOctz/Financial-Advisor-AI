"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ForecastErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Forecast error: ", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-6 w-6 text-red-600 shrink-0 mt-1" />
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-red-800">Forecast Error</h3>
                  <p className="text-red-700 text-sm mt-1">
                    {this.state.error?.message ||
                      "An unexpected error occurred while generating the forecast."}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-red-600">
                    This could be due to insufficient data, server issues, or a
                    problem with the forecasting model.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      this.setState({ hasError: false, error: null })
                    }
                    className="border-red-300 text-red-700 hover:bg-red-100"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }
  }
}
