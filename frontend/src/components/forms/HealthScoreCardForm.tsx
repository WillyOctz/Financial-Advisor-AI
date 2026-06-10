"use client";

import React from "react";
import { motion } from "framer-motion";
import { Heart, Calendar, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface HealthScoreCardProps {
  healthScore?: number;
  timeframe: string;
}

export const HealthScoreCard: React.FC<HealthScoreCardProps> = ({
  healthScore,
  timeframe,
}) => {
  const score = healthScore ?? 0;
  const isNegative = score < 0;
  const isVeryLow = score < 20;

  // Clamp display value: SVG circle only goes 0-100, but score text shows real value
  const clampedForCircle = Math.max(0, Math.min(100, score));

  const getColors = () => {
    if (score < 0) return { text: "text-rose-700", bg: "bg-rose-100", stroke: "#e11d48" };
    if (score >= 70) return { text: "text-emerald-600", bg: "bg-emerald-100", stroke: "#10b981" };
    if (score >= 50) return { text: "text-amber-600", bg: "bg-amber-100", stroke: "#f59e0b" };
    if (score >= 30) return { text: "text-orange-600", bg: "bg-orange-100", stroke: "#f97316" };
    return { text: "text-rose-600", bg: "bg-rose-100", stroke: "#f43f5e" };
  };

  const getLabel = () => {
    if (score < 0) return "Critical — Spending Exceeds Income";
    if (score >= 70) return "Excellent";
    if (score >= 50) return "Good";
    if (score >= 30) return "Fair";
    return "Needs Improvement";
  };

  const getMessage = () => {
    if (score < 0)
      return "Your expenses exceed your income. Immediate budget review is recommended.";
    if (score >= 70) return "Your finances are in great shape. Keep it up!";
    if (score >= 50) return "Your finances are healthy. Minor improvements possible.";
    if (score >= 30) return "Room to improve. Consider reviewing your spending habits.";
    return "Need better planning. Focus on reducing expenses.";
  };

  const colors = getColors();

  // Broken circle animation for negative/critical scores
  const brokenSegments = isNegative
    ? [
        { offset: "0 440", delay: 0 },
        { offset: "30 410", delay: 0.2 },
        { offset: "20 420", delay: 0.4 },
      ]
    : null;

  return (
    <Card className="border-0 shadow-2xl overflow-hidden bg-linear-to-br from-white to-slate-50">
      <CardContent className="p-8">
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Score Circle */}
          <div className="relative">
            <svg className="w-40 h-40 transform -rotate-90">
              {/* Background track */}
              <circle
                cx="80" cy="80" r="70"
                stroke="currentColor" strokeWidth="12"
                fill="none" className="text-slate-200"
              />

              {isNegative ? (
                // Broken circle for negative scores — three jagged arcs with gaps
                <>
                  <motion.circle
                    cx="80" cy="80" r="70"
                    stroke={colors.stroke} strokeWidth="12"
                    fill="none" strokeLinecap="round"
                    initial={{ strokeDasharray: "0 440" }}
                    animate={{ strokeDasharray: "60 380", strokeDashoffset: -10 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                  <motion.circle
                    cx="80" cy="80" r="70"
                    stroke={colors.stroke} strokeWidth="12"
                    fill="none" strokeLinecap="round"
                    initial={{ strokeDasharray: "0 440" }}
                    animate={{ strokeDasharray: "50 390", strokeDashoffset: -85 }}
                    transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
                  />
                  <motion.circle
                    cx="80" cy="80" r="70"
                    stroke={colors.stroke} strokeWidth="12"
                    fill="none" strokeLinecap="round"
                    initial={{ strokeDasharray: "0 440" }}
                    animate={{ strokeDasharray: "40 400", strokeDashoffset: -150 }}
                    transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                  />
                  {/* Shake animation overlay */}
                  <motion.circle
                    cx="80" cy="80" r="70"
                    stroke="#fca5a5" strokeWidth="3"
                    fill="none" strokeLinecap="round"
                    strokeDasharray="5 435"
                    animate={{ strokeDashoffset: [0, -440] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  />
                </>
              ) : (
                // Normal smooth arc
                <motion.circle
                  cx="80" cy="80" r="70"
                  stroke={colors.stroke} strokeWidth="12"
                  fill="none" strokeLinecap="round"
                  initial={{ strokeDasharray: "0 440" }}
                  animate={{ strokeDasharray: `${clampedForCircle * 4.4} 440` }}
                  transition={{ duration: 2, ease: "easeOut" }}
                />
              )}
            </svg>

            {/* Score number */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                {isNegative ? (
                  <motion.div
                    animate={{ rotate: [-2, 2, -2] }}
                    transition={{ duration: 0.3, repeat: 5, delay: 0.5 }}
                  >
                    <AlertTriangle className={`w-10 h-10 mx-auto ${colors.text}`} />
                  </motion.div>
                ) : (
                  <motion.div
                    className="text-4xl font-bold text-slate-900"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5, type: "spring" }}
                  >
                    {score}
                  </motion.div>
                )}
                <div className="text-sm text-slate-500">/ 100</div>
              </div>
            </div>

            {/* Pulse ring for critical state */}
            {isNegative && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-rose-400"
                animate={{ scale: [1, 1.15, 1], opacity: [0.8, 0, 0.8] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </div>

          {/* Score Details */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {isNegative ? (
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 0.5, repeat: 3, delay: 0.8 }}
                >
                  <AlertTriangle className={`w-5 h-5 ${colors.text}`} />
                </motion.div>
              ) : (
                <Heart className={`w-5 h-5 ${colors.text}`} />
              )}
              <h3 className="text-2xl font-bold text-slate-900">
                Financial Health Score
              </h3>
            </div>

            <motion.div
              className={`inline-block px-4 py-2 rounded-full ${colors.bg} ${colors.text} font-semibold mb-4`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.7, type: "spring" }}
            >
              {getLabel()}
            </motion.div>

            <p className="text-slate-600 text-lg mb-4">{getMessage()}</p>

            {isNegative && (
              <motion.div
                className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
              >
                <p className="text-rose-700 text-sm font-medium">
                  ⚠ Your net savings is negative. This means your expenses
                  exceed your income this period. Review your top spending
                  categories and consider reducing discretionary expenses.
                </p>
              </motion.div>
            )}

            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Calendar className="w-4 h-4" />
              <span>
                Analysis Period:{" "}
                {timeframe === "latest_month" ? "Current month" : "All time"}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};