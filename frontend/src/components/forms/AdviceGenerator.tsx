"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AIAdviceResponse } from "@/types/financial";
import {
  Brain,
  Lightbulb,
  Target,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Shield,
  Zap,
  BarChart,
  Clock,
} from "lucide-react";
import { text } from "stream/consumers";

interface EnhancedAIAdviceResponse extends AIAdviceResponse {
  financial_health_score?: number;
  key_metrics?: {
    savings_rate?: number;
    expense_to_income_ratio?: number;
    essential_spending_ratio?: number;
  };
  risk_assessment?: string[];
  improvement_oppurtunities?: string[];
}

interface AdviceGeneratorProps {
  onGenerateAdvice: (customPrompt?: string) => Promise<void>;
  advice: EnhancedAIAdviceResponse | null;
  isLoading: boolean;
  error: string | null;
  userId: number;
  financialHealthScore?: number;
}

export const AdviceGenerator: React.FC<AdviceGeneratorProps> = ({
  onGenerateAdvice,
  advice,
  isLoading,
  error,
  userId,
  financialHealthScore,
}) => {
  const [customPrompt, setCustomPrompt] = useState("");
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const [selectedQuickPrompt, setSelectedQuickPrompt] = useState<string | null>(
    null
  );

  const handleGenerateStandardAdvice = () => {
    setSelectedQuickPrompt(null);
    onGenerateAdvice();
  };

  const handleGenerateCustomAdvice = () => {
    onGenerateAdvice(customPrompt);
    setCustomPrompt("");
    setShowCustomPrompt(false);
    setSelectedQuickPrompt(null);
  };

  const handleQuickPromptClick = (prompt: string) => {
    setCustomPrompt(prompt);
    setSelectedQuickPrompt(prompt);
    onGenerateAdvice(prompt);
  };

  const getFinancialHealthColor = (score?: number) => {
    if (!score) return "text-gray-600";
    if (score >= 70) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getFinancialHealthBg = (score?: number) => {
    if (!score) return "bg-gray-100";
    if (score >= 70) return "bg-green-100";
    if (score >= 50) return "bg-yellow-100";
    return "bg-red-100";
  };

  const getFinancialHealthLabel = (score?: number) => {
    if (!score) return "Not available";
    if (score >= 70) return "Excellent";
    if (score >= 50) return "Could be better";
    if (score >= 30) return "Need review";
    return "You need to look in the mirror, but your spending itself";
  };

  const quickPrompts = [
    {
      icon: <TrendingUp className="w-4 h-4" />,
      text: "How can i improve my savings rate?",
      category: "savings",
    },
    {
      icon: <TrendingDown className="w-4 h-4" />,
      text: "what are my most biggest spendings?",
      category: "expenses",
    },
    {
      icon: <DollarSign className="w-4 h-4" />,
      text: "suggest ways to reduce monthly expenses",
      category: "budgeting",
    },
    {
      icon: <Target className="w-4 h-4" />,
      text: "How should i allocate my income better?",
      category: "allocation",
    },
    {
      icon: <Shield className="w-4 h-4" />,
      text: "What financial risks should i be aware off?",
      category: "risk",
    },
    {
      icon: <Zap className="w-4 h-4" />,
      text: "Give me quick wins to improve finances",
      category: "quick-wins",
    },
  ];

  return (
    <Card className="border-blue-100">
      <CardHeader className="bg-linear-to-r from-blue-50 to-indigo-50 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Brain className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                AI Financial Advisor
              </h3>
            </div>
          </CardTitle>

          {/* Financial Health Score */}
          {(advice?.financial_health_score !== undefined ||
            financialHealthScore !== undefined) && (
            <div
              className={`px-4 py-2 rounded-lg ${getFinancialHealthBg(
                advice?.financial_health_score || financialHealthScore
              )}`}
            >
              <div className="flex items-center space-x-2">
                <BarChart
                  className={`w-4 h-4 ${getFinancialHealthColor(
                    advice?.financial_health_score || financialHealthScore
                  )}`}
                />
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-600">
                    Financial Health
                  </div>
                  <div className="flex items-baseline space-x-1">
                    <span
                      className={`text-2xl font-bold ${getFinancialHealthColor(
                        advice?.financial_health_score || financialHealthScore
                      )}`}
                    >
                      {advice?.financial_health_score || financialHealthScore}
                    </span>
                    <span className="text-sm text-gray-500">/100</span>
                  </div>
                  <div
                    className={`text-xs font-medium ${getFinancialHealthColor(
                      advice?.financial_health_score || financialHealthScore
                    )}`}
                  >
                    {getFinancialHealthLabel(
                      advice?.financial_health_score || financialHealthScore
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-2 pt-2">
        {/* Error Display */}
        {error && (
          <div className="flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">
                Failed to generate advice
              </p>
              <p className="text-red-700 text-sm">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 border-red-300 text-red-700 hover:bg-red-100"
                onClick={handleGenerateStandardAdvice}
              >
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Custom Prompt input */}
        {showCustomPrompt && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900">Custom Question</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCustomPrompt(false);
                  setCustomPrompt("");
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                Cancel
              </Button>
            </div>
            <div className="space-y-3">
              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Ask specific financial questions... (ex. What can i do to save more?)"
                rows={3}
                className="w-full resize-none"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">
                  Be specific for better advice
                </span>
                <Button
                  onClick={handleGenerateCustomAdvice}
                  disabled={isLoading || !customPrompt.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Generate Advice
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Prompts */}
        {!showCustomPrompt && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900">Quick Questions</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCustomPrompt(true)}
                className="text-blue-600 hover:text-blue-700"
              >
                + Custom Question
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {quickPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickPromptClick(prompt.text)}
                  disabled={isLoading && selectedQuickPrompt === prompt.text}
                  className={`p-3 rounded-lg transition-all duration-200 text-left group ${
                    selectedQuickPrompt === prompt.text
                      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                      : "border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                  } ${
                    isLoading && selectedQuickPrompt === prompt.text
                      ? "opacity-70"
                      : ""
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div
                      className={`p-2 rounded-md ${
                        selectedQuickPrompt === prompt.text
                          ? "bg-blue-100 text-blue-600"
                          : "bg-gray-100 text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-600"
                      }`}
                    >
                      {prompt.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm leading-tight">
                        {prompt.text}
                      </p>
                      <span
                        className={`text-xs mt-1 ${
                          selectedQuickPrompt === prompt.text
                            ? "text-blue-600"
                            : "text-gray-500 group-hover:text-blue-600"
                        }`}
                      >
                        {prompt.category}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="py-12">
            <div className="text-center space-y-4">
              <div className="relative inline-block">
                <Brain className="h-16 w-16 text-blue-400 animate-pulse mx-auto" />
                <RefreshCw className="h-8 w-8 text-blue-600 animate-spin absolute inset-0 m-auto" />
              </div>
              <div>
                <p className="text-gray-700 font-medium">
                  Analyzing your financial data...
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Checking spending patterns, income trends, and optimization
                  opportunities
                </p>
              </div>
              <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full animate-pulse"
                  style={{ width: "60%" }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Advice Display */}
        {advice && !isLoading && (
          <div className="space-y-8">
            {/* Executive Summary */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Brain className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  Exercise Summary
                </h3>
              </div>
              <div className="p-4 bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                <p className="text-gray-800 leading-relaxed whitespace-pre-line">
                  {advice.advice.split("\n\n")[0] || advice.advice}
                </p>
              </div>
            </div>

            {/* Detailed Analysis */}
            {advice.advice.split("\n\n").length > 1 && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <BarChart className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Detailed Analysis
                  </h3>
                </div>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-gray-800 leading-relaxed whitespace-pre-line">
                    {advice.advice.split("\n\n").slice(1).join("\n\n")}
                  </p>
                </div>
              </div>
            )}

            {/* Key Metrics Grid */}
            {advice.key_metrics && (
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900">
                  Key Performance Indicators
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {advice.key_metrics.savings_rate !== undefined && (
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">
                          Savings Rate
                        </span>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        {advice.key_metrics.savings_rate.toFixed(1)}%
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{
                            width: `${Math.min(
                              advice.key_metrics.savings_rate,
                              100
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {advice.key_metrics.expense_to_income_ratio !== undefined && (
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">
                          Expense Ratio
                        </span>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        {advice.key_metrics.expense_to_income_ratio.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {advice.key_metrics.expense_to_income_ratio > 80
                          ? "High"
                          : advice.key_metrics.expense_to_income_ratio > 60
                          ? "Moderate"
                          : "Low"}
                      </div>
                    </div>
                  )}

                  {advice.key_metrics.essential_spending_ratio !==
                    undefined && (
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600">
                          Essential Uploading
                        </span>
                        <Shield className="h-4 w-4 text-blue-500" />
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        {advice.key_metrics.essential_spending_ratio.toFixed(1)}
                        %
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {advice.key_metrics.essential_spending_ratio > 60
                          ? "Mostly Essential"
                          : "Good Balance"}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Insights & Recommendations Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Key Insights */}
              {advice.insights && advice.insights.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Lightbulb className="h-5 w-5 text-yellow-600" />
                    </div>
                    <h4 className="text-lg font-bold text-gray-900">
                      Key Insights
                    </h4>
                  </div>
                  <div className="space-y-3">
                    {advice.insights.map((insight, index) => (
                      <div
                        key={index}
                        className="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                      >
                        <div className="shrink-0 w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center">
                          <span className="text-yellow-800 text-sm font-bold">
                            {index + 1}
                          </span>
                        </div>
                        <p className="text-gray-800 leading-relaxed">
                          {insight}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {advice.recommendation && advice.recommendation.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Target className="h-5 w-5 text-green-600" />
                    </div>
                    <h4 className="text-lg font-bold text-gray-900">
                      Actionable Recommendations
                    </h4>
                  </div>
                  <div className="space-y-3">
                    {advice.recommendation.map((rec, index) => (
                      <div
                        key={index}
                        className="flex items-start space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg"
                      >
                        <div className="shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-green-800 text-sm font-bold">
                            {index + 1}
                          </span>
                        </div>
                        <div>
                          <p className="text-gray-800 leading-relaxed">{rec}</p>
                          <div className="flex items-center space-x-2 mt-2">
                            <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                              Priority: {index === 0 ? "High" : "Medium"}
                            </span>
                            <span className="text-xs text-gray-500">
                              <Clock className="w-3 h-3 inline mr-1" />
                              1-3 Months
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Risk Assesment & Oppurtunities */}
            {(advice.risk_assessment || advice.improvement_oppurtunities) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Risk Assessment */}
                {advice.risk_assessment &&
                  advice.risk_assessment.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <div className="p-2 bg-red-100 rounded-lg">
                          <Shield className="h-5 w-5 tect-red-600" />
                        </div>
                        <h4 className="text-lg font-bold text-gray-900">
                          Risk Assessment
                        </h4>
                      </div>
                      <ul className="space-y-2">
                        {advice.risk_assessment.map((risk, index) => (
                          <li
                            key={index}
                            className="flex items-start space-x-3 p-3 bg-red-50 border border-red-200 rounded-lg"
                          >
                            <div className="w-2 h-2 bg-red-500 rounded-full mt-2 shrink-0" />
                            <span className="text-gray-800">{risk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* Improvement Oppurtunities */}
                {advice.improvement_oppurtunities &&
                  advice.improvement_oppurtunities.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Zap className="w-5 h-5 text-purple-500" />
                        </div>
                        <h4 className="text-lg font-bold text-gray-900">
                          Improvement Oppurtunities
                        </h4>
                      </div>
                      <ul className="space-y-2">
                        {advice.improvement_oppurtunities.map(
                          (oppurtunity, index) => (
                            <li
                              key={index}
                              className="flex items-start space-x-3 p-3 bg-purple-50 border border-purple-200 rounded-lg"
                            >
                              <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 shrink-0" />
                              <span className="text-gray-800">
                                {oppurtunity}
                              </span>
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
              </div>
            )}

            {/* Footer with Actions */}
            <div className="pt-6 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
                <div className="text-sm text-gray-500">
                  <span className="flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span>
                      Generated on{" "}
                      {new Date(advice.generated_at).toLocaleDateString()} at{" "}
                      {new Date(advice.generated_at).toLocaleTimeString()}
                    </span>
                  </span>
                </div>
                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={handleGenerateStandardAdvice}
                    disabled={isLoading}
                    className="flex items-center space-x-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Regenerate Advice</span>
                  </Button>
                  <Button
                    onClick={() => setShowCustomPrompt(true)}
                    variant="default"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Ask a Follow Up
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!advice && !isLoading && !showCustomPrompt && (
          <div className="text-center py-12 space-y-6">
            <div className="relative inline-block">
              <div className="mb-6">
                <div className="relative inline-block">
                  <Brain className="h-20 w-20 text-blue-400 mx-auto" />
                  <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-30"></div>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-gray-900">
                  Get AI Powered Financial Advice
                </h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  Our advanced AI analyzes your spending patterns, income
                  trends, and financial habits to provide personalized
                  recommendations.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto mt-6">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <TrendingUp className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-900">
                    Savings Optimization
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <Target className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-900">
                    Smart Budgeting
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <Shield className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-900">
                    Risk Assessment
                  </p>
                </div>
              </div>
              <Button
                onClick={handleGenerateStandardAdvice}
                size="lg"
                className="bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 mt-5"
              >
                <Brain className="h-5 w-5 mr-2" />
                Generate Your Financial Analysis
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
