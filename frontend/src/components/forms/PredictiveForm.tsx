"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Activity,
  Zap,
  Eye,
  Clock,
  Lock,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAnalysis } from "@/lib/hooks/useAnalysis";
import { useUser } from "@/lib/hooks/useUser";
import { FinancialSummary } from "@/types/financial";

interface PredictiveFormProps {
  summary: FinancialSummary | null;
}

// How many days of transaction history the user has
function getDataPeriodDays(summary: FinancialSummary | null): number {
  if (!summary) return 0;
  // Use data_period_days if backend provides it
  if ((summary as any).data_period_days) {
    return (summary as any).data_period_days;
  }
  // Fall back to earliest_transaction_date
  const earliest = (summary as any).earliest_transaction_date;
  if (earliest) {
    const days = Math.floor(
      (Date.now() - new Date(earliest).getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  }
  return 0;
}

const REQUIRED_DAYS = 90; // 3 months

// Locked overlay
const LockedOverlay: React.FC<{ dataPeriodDays: number }> = ({
  dataPeriodDays,
}) => {
  const daysRemaining = REQUIRED_DAYS - dataPeriodDays;
  const progress = Math.min(100, (dataPeriodDays / REQUIRED_DAYS) * 100);

  return (
    <div className="relative min-h-[500px] rounded-2xl overflow-hidden">
      {/* Blurred background preview */}
      <div className="absolute inset-0 blur-sm opacity-30 pointer-events-none select-none">
        <div className="p-6 space-y-4">
          <div className="h-32 bg-linear-to-r from-blue-200 to-purple-200 rounded-xl" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-slate-200 rounded-xl" />
            ))}
          </div>
          <div className="h-48 bg-linear-to-br from-indigo-100 to-blue-100 rounded-xl" />
        </div>
      </div>

      {/* Lock card */}
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
            <CardContent className="p-8 text-center">
              {/* Lock icon with pulse */}
              <div className="relative inline-block mb-6">
                <motion.div
                  className="w-20 h-20 bg-linear-to-br from-slate-700 to-slate-900 rounded-2xl flex items-center justify-center shadow-xl mx-auto"
                  animate={{ rotate: [0, -5, 5, -5, 0] }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                >
                  <Lock className="w-10 h-10 text-white" />
                </motion.div>
                <motion.div
                  className="absolute -inset-2 rounded-2xl border-2 border-slate-300"
                  animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                />
              </div>

              <h3 className="text-2xl font-bold text-slate-900 mb-2">
                Predictive Intelligence Locked
              </h3>
              <p className="text-slate-500 text-sm mb-6">
                Predictive analysis requires at least{" "}
                <span className="font-semibold text-slate-700">
                  90 days (3 months)
                </span>{" "}
                of transaction history to generate accurate predictions.
              </p>

              {/* Progress bar */}
              <div className="mb-6">
                <div className="flex justify-between text-xs text-slate-500 mb-2">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {dataPeriodDays} days collected
                  </span>
                  <span>{REQUIRED_DAYS} days required</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-linear-to-r from-blue-500 to-indigo-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>0 days</span>
                  <span className="text-blue-600 font-medium">
                    {Math.round(progress)}%
                  </span>
                  <span>90 days</span>
                </div>
              </div>

              {/* Days remaining badge */}
              <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-4 py-2 text-sm font-medium mb-6">
                <Clock className="w-4 h-4" />
                {daysRemaining > 0
                  ? `~${daysRemaining} more days until unlocked`
                  : "Almost there!"}
              </div>

              {/* What unlocks */}
              <div className="text-left space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  What you'll get access to:
                </p>
                {[
                  { icon: Eye, label: "Anomaly Detection", desc: "Unusual transaction alerts" },
                  { icon: Shield, label: "Risk Assessment", desc: "Financial risk score & breakdown" },
                  { icon: Zap, label: "Future Predictions", desc: "AI-powered risk forecasting" },
                  { icon: Activity, label: "Health Score", desc: "Comprehensive financial health" },
                ].map(({ icon: Icon, label, desc }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl opacity-60"
                  >
                    <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{label}</p>
                      <p className="text-xs text-slate-400">{desc}</p>
                    </div>
                    <Lock className="w-3 h-3 text-slate-400 ml-auto" />
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-400 mt-6">
                Keep uploading your financial documents to unlock this feature
                sooner.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

// Tabs when unlocked 
type Tab = "overview" | "anomalies" | "risk" | "future";

const tabs: { id: Tab; label: string; icon: React.FC<any> }[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "anomalies", label: "Anomalies", icon: Eye },
  { id: "risk", label: "Risk Assessment", icon: Shield },
  { id: "future", label: "Future Risks", icon: Zap },
];

const UnlockedContent: React.FC<{ userId: number }> = ({ userId }) => {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const {
    healthCheck,
    anomalies,
    riskAssessment,
    futureRisks,
    isLoading,
    fetchHealthCheck,
    fetchAnomalies,
    fetchRiskAssessment,
    fetchFutureRisks,
  } = useAnalysis();

  useEffect(() => {
    fetchHealthCheck(userId);
  }, [userId]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === "anomalies" && !anomalies) fetchAnomalies(userId);
    if (tab === "risk" && !riskAssessment) fetchRiskAssessment(userId);
    if (tab === "future" && !futureRisks) fetchFutureRisks(userId);
  };

  const health = healthCheck?.overall_health;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Predictive Intelligence
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            AI powered analysis of your spending patterns, risk, and future
            predictions
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1.5 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Feature Unlocked — 90+ days of data
        </div>
      </div>

      {/* Overview cards */}
      {health && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Health card */}
          <Card className="border-0 shadow-lg bg-linear-to-br from-blue-50 to-indigo-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Financial Health</p>
                  <p className="text-xs text-slate-500">Overall Assessment</p>
                </div>
              </div>
              <div className="text-4xl font-bold text-slate-900 mb-1">
                {health.score}
                <span className="text-xl text-slate-400">/100</span>
              </div>
              <div className="h-2 bg-blue-100 rounded-full mt-2">
                <motion.div
                  className="h-full bg-blue-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${health.score}%` }}
                  transition={{ duration: 1 }}
                />
              </div>
              <p className="text-sm font-medium text-blue-700 mt-2">
                {health.status}
              </p>
            </CardContent>
          </Card>

          {/* Anomaly card */}
          <Card className="border-0 shadow-lg bg-linear-to-br from-amber-50 to-orange-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Eye className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Anomaly Detection</p>
                  <p className="text-xs text-slate-500">Unusual transactions</p>
                </div>
              </div>
              <p className="text-4xl font-bold text-slate-900">
                {healthCheck?.anomaly_analysis?.anomalies?.length ?? 0}
              </p>
              <p className="text-sm text-slate-500 mt-1">Detected</p>
              <p className="text-sm font-medium text-amber-700 mt-2">
                {(healthCheck?.anomaly_analysis?.anomalies?.length ?? 0) === 0
                  ? "✓ All Clear"
                  : "Review needed"}
              </p>
            </CardContent>
          </Card>

          {/* Future risks card */}
          <Card className="border-0 shadow-lg bg-linear-to-br from-purple-50 to-violet-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Future Risks</p>
                  <p className="text-xs text-slate-500">AI Predictions</p>
                </div>
              </div>
              <p className="text-4xl font-bold text-slate-900">
                {healthCheck?.future_risk_prediction?.future_risks?.length ?? 0}
              </p>
              <p className="text-sm text-slate-500 mt-1">Identified</p>
              <p className="text-sm font-medium text-purple-700 mt-2">
                {(healthCheck?.future_risk_prediction?.future_risks?.length ?? 0) === 0
                  ? "✓ Looking Good"
                  : "Action recommended"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-full overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={`flex items-center gap-2 flex-1 justify-center px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === id
                ? "bg-white shadow text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {activeTab === "overview" && healthCheck && (
                <Card className="border-0 shadow-lg">
                  <CardContent className="p-6 space-y-3">
                    <p className="font-semibold text-slate-700 mb-3">
                      Priority Actions
                    </p>
                    {healthCheck.priority_actions.length > 0 ? (
                      healthCheck.priority_actions.map((action, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100"
                        >
                          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                          <p className="text-sm text-amber-800">{action}</p>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <p className="text-sm text-emerald-800 font-medium">
                          No immediate actions required. Your finances look
                          healthy!
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-slate-400 pt-2">
                      Next review recommended:{" "}
                      {healthCheck.next_review_recommended}
                    </p>
                  </CardContent>
                </Card>
              )}

              {activeTab === "anomalies" && anomalies && (
                <Card className="border-0 shadow-lg">
                  <CardContent className="p-6">
                    {anomalies.anomalies.length === 0 ? (
                      <div className="text-center py-8">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                        <p className="font-semibold text-slate-700">
                          No Anomalies Detected
                        </p>
                        <p className="text-sm text-slate-400">
                          Your transactions look normal for the past{" "}
                          {anomalies.window_days} days
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {anomalies.anomalies.map((a, i) => (
                          <div
                            key={i}
                            className="p-4 bg-rose-50 rounded-xl border border-rose-100"
                          >
                            <div className="flex justify-between mb-1">
                              <p className="font-medium text-slate-800">
                                {a.description}
                              </p>
                              <span className="text-xs bg-rose-200 text-rose-700 px-2 py-0.5 rounded-full">
                                {a.risk_level}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500">
                              {a.explanation}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {activeTab === "risk" && riskAssessment && (
                <Card className="border-0 shadow-lg">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-700">
                        Risk Score
                      </p>
                      <span className="text-2xl font-bold text-slate-900">
                        {riskAssessment.risk_score}/100
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full">
                      <motion.div
                        className={`h-full rounded-full ${
                          riskAssessment.risk_score > 70
                            ? "bg-rose-500"
                            : riskAssessment.risk_score > 40
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${riskAssessment.risk_score}%` }}
                        transition={{ duration: 1 }}
                      />
                    </div>
                    <div className="space-y-2">
                      {riskAssessment.recommendations.map((rec, i) => (
                        <p
                          key={i}
                          className="text-sm text-slate-600 flex items-start gap-2"
                        >
                          <span className="text-blue-500 mt-0.5">•</span>
                          {rec}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === "future" && futureRisks && (
                <Card className="border-0 shadow-lg">
                  <CardContent className="p-6">
                    {futureRisks.future_risks.length === 0 ? (
                      <div className="text-center py-8">
                        <TrendingUp className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                        <p className="font-semibold text-slate-700">
                          No Significant Risks Predicted
                        </p>
                        <p className="text-sm text-slate-400">
                          Keep up the good work!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {futureRisks.future_risks.map((risk, i) => (
                          <div
                            key={i}
                            className="p-4 bg-amber-50 rounded-xl border border-amber-100"
                          >
                            <div className="flex justify-between mb-1">
                              <p className="font-medium text-slate-800">
                                {risk.type}
                              </p>
                              <span className="text-xs bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full">
                                {risk.severity}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600">
                              {risk.description}
                            </p>
                            <p className="text-xs text-slate-400 mt-2">
                              📅 {risk.timeline} · 💡 {risk.mitigation}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ── Main export ────────────────────────────────────────────────────────────
export const PredictiveForm: React.FC<PredictiveFormProps> = ({ summary }) => {
  const { user } = useUser();
  const dataPeriodDays = getDataPeriodDays(summary);
  const isUnlocked = dataPeriodDays >= REQUIRED_DAYS;

  return (
    <div className="w-full">
      {isUnlocked ? (
        <UnlockedContent userId={user?.id ?? 0} />
      ) : (
        <LockedOverlay dataPeriodDays={dataPeriodDays} />
      )}
    </div>
  );
};