"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  Info,
  CheckCircle,
  TrendingUp,
  Lightbulb,
  ChevronRight,
} from "lucide-react";
import { useCurrency } from "@/lib/hooks/useCurrency";
import { formatCurrency } from "@/lib/utils/currency";

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

const typeConfig = {
  warning: {
    icon: AlertCircle,
    accent: "amber",
    dot: "bg-amber-400",
    ring: "border-amber-500/20  bg-amber-500/5",
    tag: "bg-amber-500/10   text-amber-400",
    label: "Warning",
  },
  positive: {
    icon: CheckCircle,
    accent: "emerald",
    dot: "bg-emerald-400",
    ring: "border-emerald-500/20 bg-emerald-500/5",
    tag: "bg-emerald-500/10 text-emerald-400",
    label: "Positive",
  },
  info: {
    icon: Info,
    accent: "blue",
    dot: "bg-blue-400",
    ring: "border-blue-500/20    bg-blue-500/5",
    tag: "bg-blue-500/10    text-blue-400",
    label: "Info",
  },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

export const ForecastInsights: React.FC<ForecastInsightsProps> = ({
  insights,
}) => {
  const { currency } = useCurrency();

  // helper function to convert dollar amount in text to user chosen currency
  const formatInsightText = (text: string): string => {
    const dollarRegex = /\$([0-9,]+(?:\.[0-9]{2})?)/g;
    return text.replace(dollarRegex, (match, amount) => {
      const numericAmount = parseFloat(amount.replace(/,/g, ""));
      return formatCurrency(numericAmount, currency);
    });
  };

  if (!insights || insights.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/80 p-8 text-center">
        <p className="text-slate-500 text-sm">No insights generated yet.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-slate-800/60 bg-slate-900/80 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800/60">
        <div className="w-9 h-9 rounded-xl bg-linear-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
          <Lightbulb className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-100">
            Key Forecast Insights
          </h3>
          <p className="text-xs text-slate-500">
            {insights.length} insight{insights.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="p-6 space-y-4"
      >
        {insights.map((insight, i) => {
          const cfg = typeConfig[insight.type] ?? typeConfig.info;
          const Icon = cfg.icon;

          return (
            <motion.div
              key={i}
              variants={fadeUp}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ x: 4 }}
              className={`rounded-xl border p-4 ${cfg.ring} transition-colors hover:border-opacity-40`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 240,
                    delay: 0.08 * i + 0.1,
                  }}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.tag}`}
                >
                  <Icon className="w-4 h-4" />
                </motion.div>

                <div className="flex-1 space-y-2 min-w-0">
                  {/* Title + Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-semibold text-slate-100 text-sm">
                      {insight.title}
                    </h4>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0 ${cfg.tag}`}
                    >
                      {cfg.label}
                    </span>
                  </div>

                  {/* Description */}
                  <div className="rounded-lg bg-slate-800/60 border border-slate-700/40 p-3">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {formatInsightText(insight.details)}
                    </p>
                  </div>

                  {/* Action */}
                  <div className="flex items-center gap-2 pt-1">
                    <ChevronRight
                      className={`w-3.5 h-3.5 shrink-0 text-${cfg.accent}-400`}
                    />
                    <span className="text-xs font-medium text-slate-400">
                      <span className="text-slate-300">Action: </span>
                      {insight.action}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
};
