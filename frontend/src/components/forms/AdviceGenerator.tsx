"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AIAdviceResponse } from "@/types/financial";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import {
  Brain,
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
  Send,
  ChevronRight,
  Sparkles,
  User,
  ArrowUpRight,
  Icon,
} from "lucide-react";

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

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string | EnhancedAIAdviceResponse;
  timestamp: Date;
  isAdvice?: boolean;
}

// ----------------Constants----------------
const quickPrompts = [
  {
    icon: TrendingUp,
    text: "How can i improve my savings rate?",
    category: "Savings",
  },
  {
    icon: TrendingDown,
    text: "What are my biggest spendings?",
    category: "Expense",
  },
  {
    icon: DollarSign,
    text: "Give me tips on how to reduce my spendings",
    category: "Budget",
  },
  {
    icon: Target,
    text: "How should i allocate my income better?",
    category: "Allocation",
  },
  {
    icon: Shield,
    text: "What risks should i avoid or be aware of?",
    category: "Risk",
  },
  {
    icon: Zap,
    text: "Advice me to improve my finances stability",
    category: "Quickwins",
  },
];

const getHealthScore = (score?: number) => {
  if (!score)
    return {
      color: "text-slate-400",
      bg: "from-slate-600 to-slate-700",
      label: "N/A",
      ring: "ring-slate-600",
    };
  if (score >= 70)
    return {
      color: "text-emerald-400",
      bg: "from-emerald-600 to-teal-600",
      label: "Excellent",
      ring: "ring-emerald-500/40",
    };
  if (score >= 50)
    return {
      color: "text-amber-400",
      bg: "from-amber-600 to-orange-500",
      label: "Good",
      ring: "ring-amber-500/40",
    };
  if (score >= 30)
    return {
      color: "text-orange-400",
      bg: "from-orange-500 to-red-500",
      label: "Needs Review",
      ring: "ring-orange-500/40",
    };
  return {
    color: "text-red-400",
    bg: "from-red-600 to-rose-700",
    label: "Critical!",
    ring: "ring-red-500/40",
  };
};

// ----------------Animate Variants----------------
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const slideInLeft = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0 },
};

const slideInRight = {
  hidden: { opacity: 0, x: 16 },
  visible: { opacity: 1, x: 0 },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const staggerFast = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

// ----------------Animated progress bar----------------
const AnimatedBar = ({ value, color }: { value: number; color: string }) => {
  const width = useMotionValue(0);
  const widthPct = useTransform(width, (v) => `${v}%`);

  useEffect(() => {
    const ctrl = animate(width, Math.min(value, 100), {
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1],
      delay: 0.3,
    });
    return ctrl.stop;
  }, [value]);

  return (
    <div className="mt-3 h-1 w-full rounded-full bg-slate-700/60 overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color}`}
        style={{ width: widthPct }}
      />
    </div>
  );
};

// ----------------Metric card----------------
const MetricCard = ({
  label,
  value,
  icon: Icon,
  trend,
  suffix = "%",
  delay = 0,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  trend?: "up" | "down";
  suffix?: string;
  delay?: number;
}) => {
  const barColor =
    trend === "up"
      ? "bg-linear-to-br from-emerald-500 to-teal-400"
      : trend === "down"
        ? "bg-linear-to-br from-red-500 to-rose-400"
        : "bg-linear-to-br from-blue-500 to-indigo-400";

  const iconBg =
    trend === "up"
      ? "bg-emerald-500/10"
      : trend === "down"
        ? "bg-red-500/10"
        : "bg-blue-500/10";

  const iconClr =
    trend === "up"
      ? "text-emerald-400"
      : trend === "down"
        ? "text-red-400"
        : "text-blue-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.02, borderColor: "rgba(245, 158, 11, 0.35)" }}
      className="relative overflow-hidden rounded-xl border border-slate-700/50 bg-linear-to-br from-slate-800/80 to-slate-900/80 p-4 cursor-default"
    >
      <motion.div
        className="absolute inset-0 bg-linear-to-br from-amber-500/5 to-transparent"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      />
      <div className={`p-1.5 rounded-lg ${iconBg}`}>
        <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">
          {label}
        </span>
        <div className={`p-1.5 rounded-lg ${iconBg}`}>
          <Icon className={`w-3.5 h-3.5 ${iconClr}`} />
        </div>
      </div>
      <motion.div
        className="text-2xl font-bold text-slate-100 tabular-nums"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: delay + 0.1, ease: "backOut" }}
      >
        {value.toFixed(1)}
        <span className="text-sm font-normal text-slate-400 ml-0.5">
          {suffix}
        </span>
      </motion.div>
      <AnimatedBar value={value} color={barColor} />
    </motion.div>
  );
};

// ----------------Section Label----------------
const SectionLabel = ({
  dotColor,
  textColor,
  children,
}: {
  dotColor: string;
  textColor: string;
  children: React.ReactNode;
}) => (
  <motion.div variants={fadeUp} className="flex items-center gap-2 mb-3">
    <div className={`w-1 h-4 rounded-full ${dotColor}`} />
    <h4
      className={`text-xs font-semibold uppercase tracking-widest ${textColor}`}
    >
      {children}
    </h4>
  </motion.div>
);

// ----------------Advice Display----------------
const AdviceDisplay = ({ advice }: { advice: EnhancedAIAdviceResponse }) => {
  const score = advice.financial_health_score;
  const health = getHealthScore(score);

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-6"
    >
      {/* Health Score Banner */}
      {score !== undefined && (
        <motion.div
          variants={fadeUp}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={`flex items-center justify-between p-4 rounded-xl bg-linear-to-r ${health.bg} ring-1 ${health.ring}`}
        >
          <div>
            <p className="text-xs text-white/70 uppercase tracking-widest mb-0.5">
              Financial Health Score
            </p>
            <p className="text-white font-semibold">{health.label}</p>
          </div>
          <motion.div
            className="text-right"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
          >
            <span className="text-4xl font-black text-white tabular-nums">
              {score}
            </span>
            <span className="text-white/60 text-lg">/100</span>
          </motion.div>
        </motion.div>
      )}

      {/* Summary */}
      <motion.div variants={fadeUp}>
        <SectionLabel dotColor="bg-amber-400" textColor="text-amber-400">
          Summary
        </SectionLabel>
        <div className="rounded-xl bg-slate-800/60 border border-slate-700/40 p-4">
          <p className="text-slate-200 leading-relaxed text-sm whitespace-pre-line">
            {advice.advice.split("\n\n")[0] || advice.advice}
          </p>
        </div>
      </motion.div>

      {/* Detailed Analysis */}
      {advice.advice.split("\n\n").length > 1 && (
        <motion.div variants={fadeUp}>
          <SectionLabel dotColor="bg-blue-400" textColor="text-blue-400">
            Detailed Analysis
          </SectionLabel>
          <div className="rounded-xl bg-slate-800/60 border border-slate-700/40 p-4">
            <p className="text-slate-200 leading-relaxed text-sm whitespace-pre-line">
              {advice.advice.split("\n\n").slice(1).join("\n\n")}
            </p>
          </div>
        </motion.div>
      )}

      {/* Key Metrics */}
      {advice.key_metrics && (
        <motion.div variants={fadeUp}>
          <SectionLabel dotColor="bg-violet-400" textColor="text-violet-400">
            Key Metrics
          </SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {advice.key_metrics.savings_rate !== undefined && (
              <MetricCard
                label="Savings Rate"
                value={advice.key_metrics.savings_rate}
                icon={TrendingUp}
                trend="up"
                delay={0}
              />
            )}
            {advice.key_metrics.expense_to_income_ratio !== undefined && (
              <MetricCard
                label="Expense Ratio"
                value={advice.key_metrics.expense_to_income_ratio}
                icon={TrendingDown}
                trend="down"
                delay={0.1}
              />
            )}
            {advice.key_metrics.essential_spending_ratio !== undefined && (
              <MetricCard
                label="Essential Spending"
                value={advice.key_metrics.essential_spending_ratio}
                icon={Shield}
                delay={0.2}
              />
            )}
          </div>
        </motion.div>
      )}

      {/* Insights */}
      {advice.insights && advice.insights.length > 0 && (
        <motion.div variants={fadeUp}>
          <SectionLabel dotColor="bg-amber-400" textColor="text-amber-400">
            Key insights
          </SectionLabel>
          <motion.div
            variants={staggerFast}
            initial="hidden"
            animate="visible"
            className="space-y-2"
          >
            {advice.insights.map((insight, i) => (
              <motion.div
                key={i}
                variants={slideInLeft}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ x: 4 }}
                className="flex gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15 hover:border-amber-500/30 transition-colors"
              >
                <span className="shrink-0 w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-bold">
                  {i + 1}
                </span>
                <p className="text-slate-300 text-sm leading-relaxed">
                  {insight}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}

      {/* Recommendations */}
      {advice.recommendation && advice.recommendation.length > 0 && (
        <motion.div variants={fadeUp}>
          <SectionLabel dotColor="bg-emerald-400" textColor="text-emerald-400">
            Action Plan
          </SectionLabel>
          <motion.div
            variants={staggerFast}
            initial="hidden"
            animate="visible"
            className="space-y-2"
          >
            {advice.recommendation.map((rec, i) => (
              <motion.div
                key={i}
                variants={slideInLeft}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ x: 4 }}
                className="flex gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15 hover:border-emerald-500/30 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-slate-300 text-sm leading-relaxed">
                    {rec}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${i === 0 ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"}`}
                    >
                      {i === 0 ? "High Priority" : "Medium Priority"}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 1-3 months
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}

      {/* Risk & Oppurtunities */}
      {advice.risk_assessment?.length ||
      advice.improvement_oppurtunities?.length ? (
        <motion.div
          variants={fadeUp}
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          {advice.risk_assessment && advice.risk_assessment.length > 0 && (
            <div>
              <SectionLabel dotColor="bg-red-400" textColor="text-red-400">
                Risk Factor
              </SectionLabel>
              <motion.div
                variants={staggerFast}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                {advice.risk_assessment.map((risk, i) => (
                  <motion.div
                    key={i}
                    variants={slideInLeft}
                    whileHover={{ x: 4 }}
                    className="flex gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/15 hover:border-red-500/30 transition-colors"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 shrink-0" />
                    <p className="text-slate-300 text-sm leading-relaxed">
                      {risk}
                    </p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          )}
          {advice.improvement_oppurtunities &&
            advice.improvement_oppurtunities.length > 0 && (
              <div>
                <SectionLabel
                  dotColor="bg-violet-400"
                  textColor="text-violet-400"
                >
                  Oppurtunities
                </SectionLabel>
                <motion.div
                  variants={staggerFast}
                  initial="hidden"
                  animate="visible"
                  className="space-y-2"
                >
                  {advice.improvement_oppurtunities.map((opp, i) => (
                    <motion.div
                      key={i}
                      variants={slideInRight}
                      whileHover={{ x: 4 }}
                      className="flex gap-3 p-3 rounded-lg bg-violet-500/5 border border-violet-500/15 hover:border-violet-500/30 transition-colors"
                    >
                      <ArrowUpRight className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                      <p className="text-slate-300 text-sm leading-relaxed">
                        {opp}
                      </p>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            )}
        </motion.div>
      ) : null}

      {/* TimeStamps */}
      <motion.div
        variants={fadeIn}
        className="flex items-center gap-1.5 text-xs text-slate-600 pt-2 border-t border-slate-800/60"
      >
        <Clock className="w-3 h-3" />
        <span>
          Generated {new Date(advice.generated_at).toLocaleDateString()} at{" "}
          {new Date(advice.generated_at).toLocaleTimeString()}
        </span>
      </motion.div>
    </motion.div>
  );
};

// ----------------Typing Place----------------
const TypingIndicator = () => (
  <motion.div
    initial={{ opacity: 0, y: 10, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 10, scale: 0.95 }}
    transition={{ duration: 0.25 }}
    className="flex gap-3"
  >
    <div className="w-8 h-8 rounded-xl bg-linear-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
      <Brain className="w-4 h-4 text-white" />
    </div>
    <div className="px-5 py-4 rounded-2xl rounded-tl-sm bg-slate-900/80 border border-slate-800/60 flex items-center gap-3">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-amber-400"
            animate={{ y: [0, -5, 0] }}
            transition={{
              duration: 0.7,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      <span className="text-slate-400 text-xs">
        Analyzing your financial data...
      </span>
    </div>
  </motion.div>
);

// ----------------App Header----------------
const AppHeader = ({
  isLoading,
  score,
  health,
  hasStarted,
  onReset,
}: {
  isLoading: boolean;
  score?: number;
  health: ReturnType<typeof getHealthScore>;
  hasStarted: boolean;
  onReset: () => void;
}) => (
  <motion.header
    initial={{ opacity: 0, y: -12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: "easeOut" }}
    className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10"
  >
    <div className="flex items-center gap-3">
      <div className="relative">
        <motion.div
          className="w-9 h-9 rounded-xl bg-linear-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25"
          whileHover={{ scale: 1.08, rotate: 3 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Brain className="w-5 h-5 text-white" />
        </motion.div>
        <motion.span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-950 ${isLoading ? "bg-amber-400" : "bg-emerald-400"}`}
          animate={{ scale: isLoading ? [1, 1.4, 1] : 1 }}
          transition={{ duration: 1, repeat: isLoading ? Infinity : 0 }}
        />
      </div>
      <div>
        <h1 className="text-sm font-semibold text-slate-100">
          AI Financial Advisor
        </h1>
        <AnimatePresence mode="wait">
          <motion.p
            key={isLoading ? "loading" : "ready"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-xs text-slate-500"
          >
            {isLoading ? "Analyzing your data..." : "Ready"}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>

    <div className="flex items-center gap-3">
      <AnimatePresence>
        {score !== undefined && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ring-1 ${health.ring} bg-slate-800/60`}
          >
            <BarChart className={`w-3.5 h-3.5 ${health.color}`} />
            <span className={`text-sm font-bold tabular-nums ${health.color}`}>
              {score}
            </span>
            <span className="text-slate-500 text-xs">/100</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hasStarted && (
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="text-slate-400 hover:text-slate-200 text-xs"
            >
              New Chat
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </motion.header>
);

export const AdviceGenerator: React.FC<AdviceGeneratorProps> = ({
  onGenerateAdvice,
  advice,
  isLoading,
  error,
  userId,
  financialHealthScore,
}) => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasStarted, setHasStarted] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const score = advice?.financial_health_score ?? financialHealthScore;
  const health = getHealthScore(score);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (advice && hasStarted) {
      setMessages((prev) => {
        if (prev[prev.length - 1]?.role === "assistant") return prev;
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: advice,
            timestamp: new Date(),
            isAdvice: true,
          },
        ];
      });
    }
  }, [advice]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    setHasStarted(true);
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      },
    ]);
    setInput("");
    await onGenerateAdvice(text.trim());
  };

  const handleInitialGenerate = async () => {
    setHasStarted(true);
    setMessages([]);
    await onGenerateAdvice();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleReset = () => {
    setHasStarted(false);
    setMessages([]);
  };

  // ----------------Landing----------------
  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-[#1e1f22] flex flex-col">
        <AppHeader
          isLoading={isLoading}
          score={score}
          health={health}
          hasStarted={hasStarted}
          onReset={handleReset}
        />
        <motion.div
          key="landing"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="flex-1 flex flex-col items-center justify-center px-6 py-16 space-y-10"
        >
          {/* Hero icon + headline */}
          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="text-center space-y-4 max-w-lg"
          >
            <motion.div
              className="relative inline-flex items-center justify-center mb-2"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, type: "spring", stiffness: 150 }}
            >
              <motion.div
                className="absolute inset-0 rounded-full bg-amber-500/20 blur-2xl scale-150"
                animate={{ opacity: [0.5, 0.9, 0.5] }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <motion.div
                className="relative w-20 h-20 rounded-2xl bg-linear-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-2xl shadow-amber-500/30"
                whileHover={{ rotate: [0, -5, 5, 0], scale: 1.05 }}
                transition={{ duration: 0.5 }}
              >
                <Sparkles className="w-10 h-10 text-white" />
              </motion.div>
            </motion.div>

            <motion.h2
              variants={fadeUp}
              className="text-3xl font-black text-slate-100 tracking-tight"
            >
              Your personal{" "}
              <span className="text-transparent bg-clip-text bg-linear-to-r from-amber-400 to-orange-400">
                financial AI
              </span>
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="text-slate-400 leading-relaxed"
            >
              Analyzes your spending patterns, income trends, and financial
              habits to deliver precise, actionable advice.
            </motion.p>
          </motion.div>

          {/* Feature pills */}
          <motion.div
            variants={staggerFast}
            className="flex flex-wrap justify-center gap-3"
          >
            {[
              {
                icon: TrendingUp,
                label: "Savings Optimization",
                cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
              },
              {
                icon: Target,
                label: "Smart Budgeting",
                cls: "text-blue-400 bg-blue-500/10 border-blue-500/20",
              },
              {
                icon: Shield,
                label: "Risk Assessment",
                cls: "text-violet-400 bg-violet-500/10 border-violet-500/20",
              },
            ].map(({ icon: Icon, label, cls }) => (
              <motion.div
                key={label}
                variants={fadeUp}
                whileHover={{ scale: 1.06, y: -2 }}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium ${cls} cursor-default`}
              >
                <Icon className="w-4 h-4" /> {label}
              </motion.div>
            ))}
          </motion.div>

          {/* Quick prompt grid */}
          <motion.div
            variants={staggerFast}
            className="w-full max-w-2xl space-y-3"
          >
            <p className="text-xs text-slate-500 text-center uppercase tracking-widest">
              Try asking
            </p>
            <motion.div
              variants={staggerFast}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2"
            >
              {quickPrompts.map(({ icon: Icon, text, category }) => (
                <motion.button
                  key={text}
                  variants={fadeUp}
                  onClick={() => sendMessage(text)}
                  disabled={isLoading}
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-800/80 bg-slate-900/60 hover:border-amber-500/30 hover:bg-slate-800/80 text-left group transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-800 group-hover:bg-amber-500/10 flex items-center justify-center shrink-0 transition-colors">
                    <Icon className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 group-hover:text-slate-100 transition-colors truncate">
                      {text}
                    </p>
                    <span className="text-xs text-slate-600">{category}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 shrink-0 transition-colors" />
                </motion.button>
              ))}
            </motion.div>
          </motion.div>

          {/* CTA */}
          <motion.button
            variants={fadeUp}
            onClick={handleInitialGenerate}
            disabled={isLoading}
            whileHover={{
              scale: 1.04,
              boxShadow: "0 20px 40px rgba(245,158,11,0.35)",
            }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 260 }}
            className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-linear-to-r from-amber-500 to-orange-500 text-white font-semibold shadow-xl shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Brain className="w-5 h-5" />
            Generate Full Financial Analysis
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // ----------------Chat----------------
  return (
    <div className="min-h-screen bg-[#6c6e74] flex flex-col">
      <AppHeader
        isLoading={isLoading}
        score={score}
        health={health}
        hasStarted={hasStarted}
        onReset={handleReset}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 max-w-4xl mx-auto w-full">
        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20"
            >
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 font-medium text-sm">
                  Failed to generate advice
                </p>
                <p className="text-red-400/70 text-xs mt-0.5">{error}</p>
                <button
                  onClick={handleInitialGenerate}
                  className="mt-2 text-xs text-red-400 underline underline-offset-2"
                >
                  Try again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message bubbles */}
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              <motion.div
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, delay: 0.05 }}
                className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center ${
                  msg.role === "user"
                    ? "bg-slate-700 text-slate-300"
                    : "bg-linear-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/20"
                }`}
              >
                {msg.role === "user" ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Brain className="w-4 h-4" />
                )}
              </motion.div>
              <div
                className={`max-w-[85%] flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                {msg.role === "user" ? (
                  <div className="px-4 py-3 rounded-2xl rounded-tr-sm bg-slate-700/80 border border-slate-600/40 text-slate-200 text-sm leading-relaxed">
                    {msg.content as string}
                  </div>
                ) : (
                  <div className="rounded-2xl rounded-tl-sm bg-slate-900/80 border border-slate-800/60 p-5 w-full">
                    {msg.isAdvice && typeof msg.content === "object" ? (
                      <AdviceDisplay
                        advice={msg.content as EnhancedAIAdviceResponse}
                      />
                    ) : (
                      <p className="text-slate-200 text-sm leading-relaxed">
                        {msg.content as string}
                      </p>
                    )}
                  </div>
                )}
                <span className="text-[10px] text-slate-600 px-1">
                  {msg.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        <AnimatePresence>{isLoading && <TypingIndicator />}</AnimatePresence>

        {/* Empty quick prompts */}
        <AnimatePresence>
          {messages.length === 0 && !isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-2 sm:grid-cols-3 gap-2"
            >
              {quickPrompts.map(({ icon: Icon, text }, i) => (
                <motion.button
                  key={text}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  onClick={() => sendMessage(text)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-800/80 bg-slate-900/50 hover:border-amber-500/30 hover:bg-slate-800/60 text-left group transition-colors"
                >
                  <Icon className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 shrink-0 transition-colors" />
                  <span className="text-xs text-slate-400 group-hover:text-slate-200 line-clamp-1 transition-colors">
                    {text}
                  </span>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={chatEndRef} />
      </div>

      {/* Input Bar */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="sticky bottom-0 border-t border-slate-800/60 bg-slate-950/90 backdrop-blur-md px-4 py-4"
      >
        <div className="max-w-4xl mx-auto flex gap-3 items-end">
          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me about your finances… (Enter to send)"
              rows={1}
              disabled={isLoading}
              className="w-full resize-none rounded-xl border border-slate-700/60 bg-slate-800/60 text-slate-200 placeholder:text-slate-500 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 px-4 py-3 text-sm transition-all min-h-[46px] max-h-32 disabled:opacity-50"
            />
          </div>

          <motion.button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="w-11 h-11 rounded-xl bg-linear-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="spin"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </motion.div>
              ) : (
                <motion.div
                  key="send"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Send className="w-4 h-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-[10px] text-slate-600 mt-2"
        >
          AI-generated advice. Always consult a licensed financial advisor for
          major decisions.
        </motion.p>
      </motion.div>
    </div>
  );
};
