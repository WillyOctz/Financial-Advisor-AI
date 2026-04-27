"use client";

import React from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  Database,
  FileText,
  ChevronRight,
} from "lucide-react";


interface UploadProgressProps {
  uploadStage: string;
  uploadProgress: number;
  uploadDetails: string;
  uploadId?: string | null;
  onCancel?: () => void;
  isCancelling?: boolean;
  isComplete?: boolean;
  isError?: boolean;
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: { duration: 0.3 },
  },
} satisfies Variants;

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
} satisfies Variants;

const pulseVariants = {
  pulse: {
    scale: [1, 1.05, 1],
    opacity: [0.5, 1, 0.5],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
} satisfies Variants;

const progressStages = [
  { value: 0, label: "Initializing", icon: Upload, color: "blue" },
  { value: 25, label: "Processing", icon: Database, color: "purple" },
  { value: 50, label: "Analyzing", icon: FileText, color: "cyan" },
  { value: 75, label: "Finalizing", icon: Zap, color: "green" },
  { value: 100, label: "Complete", icon: CheckCircle2, color: "emerald" },
];

export const UploadProgress: React.FC<UploadProgressProps> = ({
  uploadStage,
  uploadProgress,
  uploadDetails,
  uploadId,
  onCancel,
  isCancelling = false,
  isComplete = false,
  isError = false,
}) => {
  const getCurrentStage = () => {
    if (isError) return { ...progressStages[0], color: "red" };
    if (isComplete) return progressStages[4];

    for (let i = progressStages.length - 1; i >= 0; i--) {
      if (uploadProgress >= progressStages[i].value) {
        return progressStages[i];
      }
    }

    return progressStages[0];
  };

  const currentStage = getCurrentStage();
  const StageIcon = currentStage.icon;

  const getGradientColors = () => {
    if (isError) return "from-red-500 via-rose-500 to-pink-500";
    if (isComplete) return "from-emerald-500 via-green-500 to-teal-500";
    return "from-blue-500 via-purple-500 to-cyan-500";
  };

  const getGlowColor = () => {
    if (isError) return "rgba(239, 68, 68, 0.3)";
    if (isComplete) return "rgba(16, 185, 129, 0.3)";
    return "rgba(59, 130, 246, 0.3)";
  };

  // particle animation
  const Particles = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-linear-to-r from-blue-400 to-purple-400 rounded-full"
          initial={{
            x: Math.random() * 100 + "%",
            y: "100%",
            opacity: 0,
          }}
          animate={{
            y: "-20%",
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: i * 0.3,
            ease: "easeOut",
          }}
          style={{
            left: `${Math.random() * 100}%`,
          }}
        />
      ))}
    </div>
  );

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="relative"
    >
      <Card className="border-0 shadow-2xl overflow-hidden backdrop-blur-sm bg-white/95">
        {/* Animated gradient background */}
        <div className="absolute inset-0 opacity-5">
          <motion.div
            className={`absolute inset-0 opacity-5`}
            animate={{
              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{
              backgroundSize: "200% 200%",
            }}
          />
        </div>

        {!isComplete && <Particles />}

        <CardContent className="p-6 md:p-8 relative z-10">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                {/* Animated Icon */}
                <motion.div
                  className="relative shrink-0"
                  variants={itemVariants}
                >
                  <motion.div
                    className={`w-14 h-14 rounded-2xl bg-linear-to-br ${getGradientColors()} flex items-center justify-center shadow-lg`}
                    animate={!isComplete && !isError ? pulseVariants : {}}
                    style={{
                      boxShadow: `0 0 30px ${getGlowColor()}`,
                    }}
                  >
                    {isError ? (
                      <AlertCircle className="w-7 h-7 text-white" />
                    ) : isComplete ? (
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 200,
                          damping: 15,
                        }}
                      >
                        <CheckCircle2 className="w-7 h-7 text-white" />
                      </motion.div>
                    ) : isCancelling ? (
                      <Loader2 className="w-7 h-7 text-white animate-spin" />
                    ) : (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                      >
                        <StageIcon className="w-7 h-7 text-white" />
                      </motion.div>
                    )}
                  </motion.div>

                  {/* Animated Ring */}
                  {!isComplete && !isError && (
                    <motion.div
                      className="absolute inset-0 rounded-2xl border-4 border-blue-400"
                      initial={{
                        scale: 1,
                        opacity: 0.5,
                      }}
                      animate={{
                        scale: 1.3,
                        opacity: 0,
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeOut",
                      }}
                    />
                  )}
                </motion.div>

                {/* Status Text */}
                <motion.div variants={itemVariants} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3
                      className={`
                          font-bold text-xl ${
                            isError
                              ? "text-red-600"
                              : isComplete
                                ? "text-emerald-600"
                                : "text-slate-900"
                          }`}
                    >
                      {uploadStage || currentStage.label}
                    </h3>
                    {isError && !isComplete && (
                      <motion.div
                        className="px-2 py-0.5 bg-blue-100 rounded-full"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <span className="text-xs font-semibold text-blue-600">
                          Active
                        </span>
                      </motion.div>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2">
                    {uploadDetails ||
                      "Processing your upload with optimized performance"}
                  </p>
                </motion.div>
              </div>

              {/* Progress Percentage & Cancel */}
              <div className="flex items-start gap-4 shrink-0">
                {!isComplete && !isError && (
                  <motion.div variants={itemVariants} className="text-right">
                    <motion.div
                      className={`
                        text-3xl font-bold bg-linear-to-r ${getGradientColors()} 
                      bg-clip-text text-transparent`}
                      key={uploadProgress}
                      initial={{ scale: 1.2, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                      }}
                    >
                      {uploadProgress}%
                    </motion.div>
                    <div className="text-xs text-slate-500 font-medium">
                      Complete
                    </div>
                  </motion.div>
                )}

                {onCancel && !isComplete && !isError && (
                  <motion.div
                    variants={itemVariants}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button
                      onClick={onCancel}
                      variant="outline"
                      size="sm"
                      disabled={isCancelling}
                      className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                    >
                      {isCancelling ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Cancelling
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </>
                      )}
                    </Button>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Main Progress Bar */}
            <motion.div variants={itemVariants} className="space-y-3">
              <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className={`absolute inset-y-0 left-0 bg-linear-to-r ${getGradientColors()} rounded-full shadow-lg`}
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{
                    duration: 0.5,
                    ease: "easeOut",
                  }}
                  style={{
                    boxShadow: `0 0 15px ${getGlowColor()}`,
                  }}
                />

                {/* Shimmer Effect */}
                {!isComplete && !isError && (
                  <motion.div
                    className="absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent"
                    animate={{
                      x: ["-100%", "200%"],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                )}
              </div>

              {/* Progress markers */}
              <div className="flex justify-between px-1">
                {[0, 25, 50, 75, 100].map((marker) => (
                  <div key={marker} className="flex flex-col items-center">
                    <motion.div
                      className={`w-2 h-2 rounded-full ${
                        uploadProgress >= marker
                          ? "bg-linear-to-r " + getGradientColors()
                          : "bg-slate-300"
                      }`}
                      initial={{ scale: 0 }}
                      animate={{
                        scale: uploadProgress >= marker ? 1 : 0.5,
                      }}
                      transition={{ type: "spring", stiffness: 300 }}
                    />
                    <span className="text-xs text-slate-400 mt-1 font-medium">
                      {marker}%
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Stage Timeline */}
            {!isComplete && !isError && (
              <motion.div
                variants={itemVariants}
                className="grid grid-cols-4 gap-2 md:gap-3"
              >
                {progressStages.slice(0, 4).map((stage, index) => {
                  const isActive =
                    uploadProgress >= stage.value &&
                    uploadProgress < (progressStages[index + 1]?.value || 100);
                  const isCompleted = uploadProgress > stage.value;
                  const Icon = stage.icon;

                  return (
                    <motion.div
                      key={stage.label}
                      className={`
                        relative p-3 rounded-xl border-2 transition-all ${
                          isActive
                            ? `border-${stage.color}-400 bg-${stage.color}-50 shadow-lg`
                            : isCompleted
                              ? `border-${stage.color}-200 bg-${stage.color}-50/50`
                              : "border-slate-200 bg-slate-50"
                        }`}
                      whileHover={{ scale: 1.05 }}
                      animate={
                        isActive
                          ? {
                              scale: [1, 1.02, 1],
                              transition: {
                                duration: 1.5,
                                repeat: Infinity,
                              },
                            }
                          : {}
                      }
                    >
                      <div className="flex flex-col items-center text-center">
                        <motion.div
                          className={`
                            w-8 h-8 md:w-10 md:h-10 rounded-lg mb-2 flex items-center justify-center ${
                              isActive || isCompleted
                                ? `bg-${stage.color}-500 text-white`
                                : "bg-slate-200 text-slate-400"
                            }
                            `}
                          animate={
                            isActive
                              ? {
                                  rotate: [0, 5, -5, 0],
                                  transition: {
                                    duration: 2,
                                    repeat: Infinity,
                                  },
                                }
                              : {}
                          }
                        >
                          <Icon className="w-4 h-4 md:w-5 md:h-5" />
                        </motion.div>
                        <span
                          className={`text-xs font-medium ${
                            isActive
                              ? `text-${stage.color}-700`
                              : isCompleted
                                ? `text-${stage.color}-600`
                                : "text-slate-500"
                          }`}
                        >
                          {stage.label}
                        </span>
                      </div>

                      {/* Progress arrow */}
                      {index < 3 && (
                        <motion.div
                          className="absolute -right-1 top-1/2 -translate-y-1/2 z-10"
                          initial={{ x: 0, opacity: 0 }}
                          animate={
                            isCompleted
                              ? {
                                  x: [0, 3, 0],
                                  opacity: 1,
                                  transition: {
                                    duration: 1,
                                    repeat: Infinity,
                                  },
                                }
                              : { opacity: 0.3 }
                          }
                        >
                          <ChevronRight
                            className={`w-4 h-4 ${
                              isCompleted
                                ? `text-${stage.color}-500`
                                : "text-slate-300"
                            }`}
                          />
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* Time estimate */}
            {!isComplete && !isError && (
              <motion.div
                variants={itemVariants}
                className="flex items-center justify-between p-4 bg-linear-to-r from-slate-50 to-blue-50 rounded-xl border border-slate-200"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-slate-600 font-medium">
                    Estimated time remaining:
                  </span>
                </div>
                <motion.span
                  className="font-bold text-slate-900"
                  key={
                    uploadProgress < 30
                      ? "long"
                      : uploadProgress < 70
                        ? "medium"
                        : "short"
                  }
                  initial={{ scale: 1.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  {uploadProgress < 30
                    ? "-30 sec"
                    : uploadProgress < 70
                      ? "-15 sec"
                      : "-5 sec"}
                </motion.span>
              </motion.div>
            )}

            {/* Success message */}
            <AnimatePresence>
              {isComplete && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.9 }}
                  className="p-4 bg-linear-to-r from-emerald-50 to-green-50 rounded-xl border-2 border-emerald-200"
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{
                        rotate: [0, 10, -10, 0],
                        transition: { duration: 0.5 },
                      }}
                    >
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    </motion.div>
                    <div>
                      <p className="font-semibold text-emerald-900">
                        Upload Complete!
                      </p>
                      <p className="text-sm text-emerald-700">
                        Your file has been processed successfully!
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error message */}
            <AnimatePresence>
              {isError && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.9 }}
                  className="p-4 bg-linear-to-r from-red-50 to-rose-50 rounded-xl border-2 border-red-200"
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{
                        rotate: [0, 5, -5, 0],
                        transition: { duration: 0.3, repeat: 3 },
                      }}
                    >
                      <AlertCircle className="w-6 h-6 text-red-600" />
                    </motion.div>
                    <div>
                      <p className="font-semibold text-red-900">
                        Upload Failed
                      </p>
                      <p className="text-sm text-red-700">
                        {uploadDetails ||
                          "Something went wrong. Please try again."}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
