"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useMotionValue, useTransform, Variants } from "framer-motion";
import { useAuth } from "../../../contexts/AuthContexts";
import {
  AlertCircle,
  ArrowRight,
  Sparkles,
  Lock,
  Mail,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import PasswordInput from "@/components/ui/password-input";

// Floating shapes animation variants
const floatingShapes = {
  shape1: {
    y: [0, -30, 0],
    x: [0, 20, 0],
    rotate: [0, 90, 0],
    transition: {
      duration: 8,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
  shape2: {
    y: [0, 40, 0],
    x: [0, -25, 0],
    rotate: [0, -120, 0],
    transition: {
      duration: 10,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
  shape3: {
    y: [0, -25, 0],
    x: [0, 30, 0],
    scale: [1, 1.2, 1],
    transition: {
      duration: 7,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
} satisfies Variants;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { login } = useAuth();

  // 3D card tilt
  const cardX = useMotionValue(0);
  const cardY = useMotionValue(0);
  const rotateX = useTransform(cardY, [-300, 300], [10, -10]);
  const rotateY = useTransform(cardX, [-300, 300], [-10, 10]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    cardX.set(e.clientX - centerX);
    cardY.set(e.clientY - centerY);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    cardX.set(0);
    cardY.set(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();

        if (data.requires_2fa && data.partial_token) {
          // 2fa required
          login(data.partial_token, data.user, true);
          router.push("/verify-2fa")
        } else if (data.access_token) {
          // no 2fa required
          login(data.access_token, data.user, false);
          router.push("/dashboard");
        } else {
          setError("Invalid response from server");
        }
      } else {
        const errorData = await res.json();
        setError(errorData.detail || "Login failed");
      }
    } catch (error) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (error?.includes("verify your email")) {
    // Show verification prompt
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 max-w-md shadow-2xl"
        >
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-6 w-6 text-yellow-600" />
            <div>
              <p className="text-yellow-800 font-semibold">
                Email Verification Required
              </p>
              <p className="text-yellow-700 text-sm mt-1">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => router.push("/verify-email")}
              >
                Verify Email
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-linear-to-br from-slate-950 via-indigo-950 to-slate-950">
      {/* Animated gradient overlay */}
      <motion.div
        className="absolute inset-0 opacity-30"
        animate={{
          background: [
            "radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3) 0%, transparent 50%)",
            "radial-gradient(circle at 80% 50%, rgba(139, 92, 246, 0.3) 0%, transparent 50%)",
            "radial-gradient(circle at 50% 80%, rgba(167, 139, 250, 0.3) 0%, transparent 50%)",
            "radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3) 0%, transparent 50%)",
          ],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      />

      {/* Floating Shapes */}
      <motion.div
        className="absolute top-20 left-20 w-32 h-32 bg-linear-to-br from-violet-500/20 to-fuchsia-500/20 rounded-full blur-3xl"
        animate={floatingShapes.shape1}
      />
      <motion.div
        className="absolute bottom-32 right-32 w-40 h-40 bg-linear-to-br from-cyan-500/20 to-blue-500/20 rounded-full blur-3xl"
        animate={floatingShapes.shape2}
      />
      <motion.div
        className="absolute top-1/2 right-20 w-24 h-24 bg-linear-to-br from-pink-500/20 to-rose-500/20 rounded-full blur-3xl"
        animate={floatingShapes.shape3}
      />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
        }}
      />

      <div className="relative min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          {/* Logo Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-8"
          >
            <motion.div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-br from-violet-500 to-fuchsia-500 mb-4 shadow-2xl shadow-violet-500/50"
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              <DollarSign className="w-8 h-8 text-white" />
            </motion.div>
            <motion.h1
              className="text-4xl font-bold bg-linear-to-r from-white via-violet-200 to-fuchsia-200 bg-clip-text text-transparent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Welcome To
            </motion.h1>
            <motion.p
              className="mt-2 text-slate-400 font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              AI Financial Advisor
            </motion.p>
          </motion.div>

          {/* 3D Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{
              perspective: 1000,
              rotateX,
              rotateY,
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="relative"
          >
            {/* Glass card with 3d Effect */}
            <div className="relative bg-slate-900/40 backdrop-blur-xl rounded-3xl border border-slate-700/50 shadow-2xl p-8 overflow-hidden">
              {/* Gradient border effect */}
              <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-violet-500/20 via-transparent to-fuchsia-500/20 opacity-50" />

              {/* Shine effect */}
              <motion.div
                className="absolute inset-0 rounded-3xl opacity-0"
                whileHover={{ opacity: 1 }}
                style={{
                  background: `radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255, 255, 255, 0.1) 0%, transparent 50%)`,
                }}
              />

              <div className="relative z-10">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-500/10 backdrop-blur-sm border border-red-500/50 text-red-300 px-4 py-3 rounded-xl flex items-center gap-3"
                    >
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <span className="text-sm">{error}</span>
                    </motion.div>
                  )}

                  {/* Email Field */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <label
                      className="block text-sm font-medium text-slate-300 mb-2"
                      htmlFor="email"
                    >
                      Email Address
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-violet-400 transition-colors" />
                      </div>
                      <motion.input
                        whileFocus={{ scale: 1.01 }}
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        className="block w-full pl-11 pr-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </motion.div>

                  {/* Password field */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-slate-300 mb-2"
                    >
                      Password
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                        <Lock className="w-5 h-5 text-slate-400 group-focus-within:text-violet-400 transition-colors" />
                      </div>
                      <PasswordInput
                        id="password"
                        name="password"
                        autoComplete="current-password"
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        error={!!error && error.includes("password")}
                        className="block w-full pl-11 pr-12 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200"
                      />
                    </div>
                  </motion.div>

                  {/* Forgot Password Link */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="flex items-center justify-end"
                  >
                    <Link
                      href="/forgot-password"
                      className="text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors mt-1"
                    >
                      Forgot Password?
                    </Link>
                  </motion.div>

                  {/* Submit Button */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    <motion.button
                      type="submit"
                      disabled={isLoading}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="relative w-full group overflow-hidden rounded-xl bg-linear-to-r from-violet-600 to-fuchsia-600 p-0.5 transition-all duration-300 hover:shadow-2xl hover:shadow-violet-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="relative bg-linear-to-r from-violet-600 to-fuchsia-600 rounded-xl px-6 py-3 transition-all duration-300">
                        <span className="relative z-10 flex items-center justify-center gap-2 text-white font-semibold">
                          {isLoading ? (
                            <>
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{
                                  duration: 1,
                                  repeat: Infinity,
                                  ease: "linear",
                                }}
                                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                              />
                              Signing in...
                            </>
                          ) : (
                            <>
                              Sign In
                              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </>
                          )}
                        </span>
                      </div>
                    </motion.button>
                  </motion.div>
                </form>

                {/* Divider */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="relative my-6"
                >
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-700/50"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-slate-900/40 text-slate-400">
                      Haven't Registered Yet?
                    </span>
                  </div>
                </motion.div>

                {/* Register Link */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="text-center"
                >
                  <Link href="/register">
                    <motion.span
                      whileHover={{ scale: 1.05 }}
                      className="inline-flex items-center gap-2 text-sm font-medium text-transparent bg-linear-to-r from-violet-400 to-fuchsia-400 bg-clip-text hover:from-violet-300 hover:to-fuchsia-300 transition-all cursor-pointer"
                    >
                      Create an account
                      <ArrowRight className="w-4 h-4 text-violet-400" />
                    </motion.span>
                  </Link>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
