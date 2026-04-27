"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useMotionValue, useTransform, Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import Input from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import {
  Mail,
  CheckCircle,
  XCircle,
  Send,
  ArrowRight,
  Sparkles,
  Clock,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

const floatingShapes = {
  shape1: {
    y: [0, -28, 0],
    x: [0, 22, 0],
    rotate: [0, 100, 0],
    transition: { duration: 8.5, repeat: Infinity, ease: "easeInOut" },
  },
  shape2: {
    y: [0, 32, 0],
    x: [0, -18, 0],
    rotate: [0, -110, 0],
    transition: { duration: 9.5, repeat: Infinity, ease: "easeInOut" },
  },
} satisfies Variants;

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [verificationMethod, setVerificationMethod] = useState<
    "token" | "email"
  >(token ? "token" : "email");

  // 3D tilt
  const cardX = useMotionValue(0);
  const cardY = useMotionValue(0);
  const rotateX = useTransform(cardY, [-300, 300], [8, -8]);
  const rotateY = useTransform(cardX, [-300, 300], [-8, 8]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    cardX.set(e.clientX - rect.left - rect.width / 2);
    cardY.set(e.clientY - rect.top - rect.height / 2);
  };

  const handleMouseLeave = () => {
    cardX.set(0);
    cardY.set(0);
  };

  useEffect(() => {
    if (token) {
      verifyToken(token);
    }
  }, [token]);

  const verifyToken = async (verificationToken: string) => {
    setStatus("loading");
    try {
      const response = await apiClient.post("/auth/verify-email", {
        token: verificationToken,
      });

      setStatus("success");
      setMessage(response.data.message);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/login?verified=true");
      }, 3000);
    } catch (error: any) {
      setStatus("error");
      setMessage(error.response?.data?.detail || "Verification failed");
    }
  };

  const handleEmailVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    try {
      const res = await apiClient.post("/auth/resend-verification", {
        email: email,
      });

      setStatus("success");
      setMessage(res.data.message);
    } catch (error: any) {
      setStatus("error");
      setMessage(
        error.response?.data?.detail || "Failed to resend verification",
      );
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-linear-to-br from-slate-950 via-purple-950 to-slate-950">
      {/* Animated gradient */}
      <motion.div
        className="absolute inset-0 opacity-30"
        animate={{
          background: [
            "radial-gradient(circle at 20% 50%, rgba(147, 51, 234, 0.3) 0%, transparent 50%)",
            "radial-gradient(circle at 80% 50%, rgba(168, 85, 247, 0.3) 0%, transparent 50%)",
            "radial-gradient(circle at 50% 80%, rgba(192, 132, 252, 0.3) 0%, transparent 50%)",
            "radial-gradient(circle at 20% 50%, rgba(147, 51, 234, 0.3) 0%, transparent 50%)",
          ],
        }}
        transition={{ duration: 12, repeat: Infinity }}
      />

      {/* Floating Shapes */}
      <motion.div
        className="absolute top-20 left-20 w-32 h-32 bg-linear-to-br from-purple-500/20 to-fuchsia-500/20 rounded-full blur-3xl"
        animate={floatingShapes.shape1}
      />
      <motion.div
        className="absolute bottom-32 right-32 w-40 h-40 bg-linear-to-br from-violet-500/20 to-purple-500/20 rounded-full blur-3xl"
        animate={floatingShapes.shape2}
      />

      <div className="relative min-h-screen flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <motion.div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-br from-purple-500 to-fuchsia-500 mb-4 shadow-2xl shadow-purple-500/50"
              whileHover={{ scale: 1.1, rotate: 5 }}
              animate={
                status === "loading"
                  ? {
                      rotate: [0, 360],
                      transition: {
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                      },
                    }
                  : {}
              }
            >
              {status === "success" ? (
                <CheckCircle className="w-8 h-8 text-white" />
              ) : status === "error" ? (
                <XCircle className="w-8 h-8 text-white" />
              ) : (
                <Mail className="w-8 h-8 text-white" />
              )}
            </motion.div>
            <h1 className="text-4xl font-bold bg-linear-to-r from-white via-purple-200 to-fuchsia-200 bg-clip-text text-transparent">
              {verificationMethod === "token"
                ? "Eamil Verification"
                : "Resend Verification"}
            </h1>
            <p className="mt-2 text-slate-400">
              {verificationMethod === "token"
                ? "Verifying your email address..."
                : "Get a new verification link"}
            </p>
          </motion.div>

          {/* 3D Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{ perspective: 1000, rotateX, rotateY }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <div className="relative bg-slate-900/40 backdrop-blur-xl rounded-3xl border border-slate-700/50 shadow-2xl p-8 overflow-hidden">
              <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-purple-500/20 via-transparent to-fuchsia-500/20 opacity-50" />
              <div className="relative z-10">
                {/* Token Verification Flow */}
                {verificationMethod === "token" && (
                  <div className="space-y-6">
                    {/* Loading State */}
                    {status === "loading" && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center space-y-4"
                      >
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                          className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/20 border-2 border-purple-500/50"
                        >
                          <Clock className="w-8 h-8 text-purple-400" />
                        </motion.div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            Verifying...
                          </h3>
                          <p className="text-sm text-slate-400 mt-2">
                            Please wait while we verify your email
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {/* Success State */}
                    {status === "success" && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center space-y-6"
                      >
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", delay: 0.2 }}
                          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50"
                        >
                          <CheckCircle className="w-10 h-10 text-emerald-400" />
                        </motion.div>
                        <div>
                          <h3 className="text-xl font-semibold text-white mb-3">
                            Email Verified
                          </h3>
                          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                            <p className="text-sm text-emerald-300">
                              {message}
                            </p>
                            <p className="text-xs text-emerald-400/80 mt-2">
                              Redirecting to login...
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => router.push("/login")}
                          className="w-full bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                        >
                          Go to Login <ArrowRight className="ml-2 w-4 h-4" />
                        </Button>
                      </motion.div>
                    )}

                    {/* Error State */}
                    {status === "error" && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-6"
                      >
                        <div className="text-center">
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", delay: 0.1 }}
                            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/50 mb-4"
                          >
                            <XCircle className="w-10 h-10 text-red-400" />
                          </motion.div>
                          <h3 className="text-xl font-semibold text-white mb-3">
                            Verification Failed
                          </h3>
                          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                            <p className="text-sm text-red-300">{message}</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <p className="text-center text-sm text-slate-400">
                            Need a new verification link?
                          </p>
                          <Button
                            onClick={() => setVerificationMethod("email")}
                            className="w-full bg-linear-to-r from-purple-600 to-fuchsia-600"
                          >
                            <Send className="mr-2 w-4 h-4" />
                            Resend Verification Email
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Email Form Flow */}
                {verificationMethod === "email" && (
                  <form
                    onSubmit={handleEmailVerification}
                    className="space-y-6"
                  >
                    {/* Info Box */}
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4"
                    >
                      <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-purple-300">
                          Enter your email to receive a new verification link
                        </p>
                      </div>
                    </motion.div>

                    {/* Email Input */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Email Address
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-purple-400 transition-colors" />
                        </div>
                      </div>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        disabled={status === "loading"}
                        className="block w-full pl-11 pr-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </motion.div>

                    {/* Success Message */}
                    {status === "success" && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4"
                      >
                        <p className="text-sm text-emerald-300">{message}</p>
                        <p className="text-xs text-emerald-400/80 mt-2">
                          Check your inbox and spam folder
                        </p>
                      </motion.div>
                    )}

                    {/* Error Message */}
                    {status === "error" && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-red-500/10 border border-red-500/30 rounded-xl p-4"
                      >
                        <p className="text-sm text-red-300">{message}</p>
                      </motion.div>
                    )}

                    {/* Submit Button */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <motion.button
                        type="submit"
                        disabled={status === "loading" || !email}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full rounded-xl bg-linear-to-r from-purple-600 to-fuchsia-600 px-6 py-3 font-semibold text-white shadow-2xl hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {status === "loading" ? (
                          <span className="flex items-center justify-center gap-2">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                                ease: "linear",
                              }}
                              className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                            />
                            Sending...
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            <Mail className="w-5 h-5" />
                            Send Verification Email
                          </span>
                        )}
                      </motion.button>
                    </motion.div>
                  </form>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
