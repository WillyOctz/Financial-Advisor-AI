"use client";

import React, { useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import {
  BarChart3,
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { AccuracyMetrics } from "@/types/financial";
import { useCurrency } from "@/lib/hooks/useCurrency";
import { formatCurrency } from "@/lib/utils/currency";
import { format } from "path";

interface ForecastAccuracyProps {
  metrics?: AccuracyMetrics;
}

// ------------------Animated Bar------------------
const AnimatedBar = ({
  value,
  color,
  delay = 0,
}: {
  value: number;
  color: string;
  delay?: number;
}) => {
  const w = useMotionValue(0);
  const wp = useTransform(w, (v) => "${v}%");

  useEffect(() => {
    const ctrl = animate(w, Math.min(value, 100), {
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1],
      delay,
    });
    return ctrl.stop;
  }, [value]);
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-800/80 overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color}`}
        style={{ width: wp }}
      />
    </div>
  );
};

// ------------------Metric Cell------------------
const MetricCell = ({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  delay,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  iconColor: string;
  delay: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    className="relative overflow-hidden rounded-xl border border-slate-700/50 bg-linear-to-br from-slate-800/80 to-slate-900/80 p-4"
  >
    <motion.div className="absolute inset-0 bg-linear-to-br from-amber-500/5 to-transparent" />
    <div className="flex items-start justify-between mb-3">
      <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">
        {label}
      </span>
      <div className={`p-1.5 rounded-lg bg-slate-800`}>
        <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
      </div>
    </div>
    <motion.p
      className="text-2xl font-bold text-slate-100 tabular-nums"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: delay + 0.1, ease: "backOut" }}
    >
      {value}
    </motion.p>
    <p className="text-xs text-slate-500 mt-1">{sub}</p>
  </motion.div>
);

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};
const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };

export const ForecastAccuracy: React.FC<ForecastAccuracyProps> = ({
  metrics,
}) => {
  const { currency } = useCurrency();

  if (!metrics) {
    return (
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/80 p-8 text-center">
        <p className="text-slate-500 text-sm">Accuracy metrics not available</p>
      </div>
    );
  }

  const getMapeConfig = (mape: number) => {
    if (mape < 10)
      return {
        color: "text-emerald-400",
        bar: "bg-gradient-to-r from-emerald-500 to-teal-400",
        icon: CheckCircle,
        label: "Excellent",
        desc: "Forecast is highly reliable for planning",
      };
    if (mape < 20)
      return {
        color: "text-amber-400",
        bar: "bg-gradient-to-r from-amber-500 to-yellow-400",
        icon: TrendingUp,
        label: "Good",
        desc: "Generally reliable for budget guidance",
      };
    if (mape < 30)
      return {
        color: "text-orange-400",
        bar: "bg-gradient-to-r from-orange-500 to-amber-400",
        icon: TrendingUp,
        label: "Fair",
        desc: "Use as guidance, not for precise planning",
      };
    return {
      color: "text-red-400",
      bar: "bg-gradient-to-r from-red-500 to-rose-400",
      icon: AlertCircle,
      label: "Low",
      desc: "Consider collecting more historical data",
    };
  };

  const conf = getMapeConfig(metrics.mape);

  const confBadge =
    metrics.confidence === "high"
      ? {
          bg: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
          label: "HIGH CONFIDENCE",
        }
      : metrics.confidence === "medium"
        ? {
            bg: "bg-amber-500/10 text-amber-400 ring-amber-500/30",
            label: "MEDIUM CONFIDENCE",
          }
        : {
            bg: "bg-red-500/10 text-red-400 ring-red-500/30",
            label: "LOW CONFIDENCE",
          };

  const guides = [
    {
      color: "bg-emerald-400",
      label: "MAPE < 10%",
      desc: "Highly accurate, reliable for planning",
    },
    {
      color: "bg-amber-400",
      label: "MAPE 10–20%",
      desc: "Good accuracy for general budget planning",
    },
    {
      color: "bg-orange-400",
      label: "MAPE 20–30%",
      desc: "Guidance only, not precise planning",
    },
    {
      color: "bg-red-400",
      label: "MAPE > 30%",
      desc: "Low accuracy — collect more historical data",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-slate-800/60 bg-slate-900/80 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              Forecast Accuracy
            </h3>
            <p className="text-xs text-slate-500">Model reliability metrics</p>
          </div>
        </div>
        <span
          className={`text-xs font-semibold px-3 py-1.5 rounded-full ring-1 ${confBadge.bg}`}
        >
          {confBadge.label}
        </span>
      </div>

      <div className="p-6 space-y-6">
        {/* Overall MAPE */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          <motion.div
            variants={fadeUp}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <conf.icon className={`w-4 h-4 ${conf.color}`} />
              <span className="text-sm font-semibold text-slate-200">
                Overall Accuracy
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full bg-slate-800 ${conf.color}`}
              >
                {conf.label}
              </span>
            </div>
            <span className={`text-2xl font-black tabular-nums ${conf.color}`}>
              {metrics.mape.toFixed(2)}
              <span className="text-sm font-normal text-slate-400 mt-0.5">
                %
              </span>
            </span>
          </motion.div>
          <motion.div variants={fadeUp}>
            <AnimatedBar
              value={100 - Math.min(metrics.mape, 100)}
              color={conf.bar}
              delay={0.2}
            />
          </motion.div>
          <motion.p variants={fadeUp} className="text-xs text-slate-500">
            {conf.desc}
          </motion.p>
        </motion.div>

        {/* Metric Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCell
            label="MAE"
            value={formatCurrency(metrics.mae, currency)}
            sub="Mean Absolute Error"
            icon={BarChart3}
            iconColor="text-blue-400"
            delay={0}
          />
          <MetricCell
            label="RMSE"
            value={formatCurrency(metrics.rmse, currency)}
            sub="Root Mean Square Error"
            icon={TrendingUp}
            iconColor="text-emerald-400"
            delay={0.08}
          />
          <MetricCell
            label="MDAPE"
            value={`${metrics.mdape.toFixed(2)}%`}
            sub="Median Abs % Error"
            icon={TrendingUp}
            iconColor="text-violet-400"
            delay={0.16}
          />
          <MetricCell
            label="Coverage"
            value={`${metrics.coverage.toFixed(1)}%`}
            sub="Confidence Coverage"
            icon={Target}
            iconColor="text-amber-400"
            delay={0.24}
          />
        </div>

        {/* Guide */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.45 }}
          className="rounded-xl border border-slate-700/40 bg-slate-800/40 p-4 space-y-3"
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-4 rounded-full bg-slate-500" />
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Accuracy Reference
            </h4>
          </div>
          {guides.map(({ color, label, desc }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 + i * 0.06, duration: 0.35 }}
              className="flex items-start gap-3"
            >
              <div
                className={`w-1.5 h-1.5 rounded-full ${color} mt-1.5 shrink-0`}
              />
              <p className="text-xs text-slate-400">
                <span className="font-semibold text-slate-300">{label}</span>{" "}
                {desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
};
