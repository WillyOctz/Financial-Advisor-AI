"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, useMotionValue, useTransform, Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import PasswordInput from "@/components/ui/password-input";
import {
  Lock,
  CheckCircle2,
  Circle,
  Shield,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  CheckCircle,
} from "lucide-react";

const floatingShapes = {
  shape1: {
    y: [0, -30, 0],
    x: [0, 20, 0],
    rotate: [0, 90, 0],
    transition: { duration: 8, repeat: Infinity, ease: "easeInOut" },
  },
  shape2: {
    y: [0, 25, 0],
    x: [0, -15, 0],
    rotate: [0, -120, 0],
    transition: { duration: 9, repeat: Infinity, ease: "easeInOut" },
  },
} satisfies Variants;

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tokenValid, setTokenValid] = useState(false);
  const [email, setEmail] = useState("");

  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  // 3D card tilt
  const cardX = useMotionValue(0);
  const cardY = useMotionValue(0);
  const rotateX = useTransform(cardY, [-300, 300], [8, -8]);
  const rotateY = useTransform(cardX, [-300, 300], [-8, 8]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    cardX.set(e.clientX - centerX);
    cardY.set(e.clientY - centerY);
  };

  const handleMouseLeave = () => {
    cardX.set(0);
    cardY.set(0);
  };

  const passwordRegex =
    /^(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).+$/;

  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return { strength: 0, label: "", color: "" };
    if (password.length < 8)
      return { strength: 1, label: "Weak", color: "bg-red-500" };
    if (!passwordRegex.test(password))
      return { strength: 2, label: "Fair", color: "bg-yellow-500" };
    if (password.length >= 12)
      return { strength: 4, label: "Strong", color: "bg-emerald-500" };
    return { strength: 3, label: "Good", color: "bg-blue-500" };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  useEffect(() => {
    if (token) {
      verifyToken();
    }
  }, [token]);

  const verifyToken = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API}/auth/verify-reset-token/${token}`,
      );

      if (res.ok) {
        const data = await res.json();
        setTokenValid(true);
        setEmail(data.email);
      } else {
        setError("Invalid or expired reset token");
        setTokenValid(false);
      }
    } catch (error) {
      setError("Failed to verify token");
      setTokenValid(false);
    }
  };

  const validatePassword = (password: string) => {
    if (password.length < 8 || !passwordRegex.test(password)) {
      setPasswordError(
        "Password must contain at least one number, one symbol, and be at least 8 characters",
      );
      return false;
    } else {
      setPasswordError("");
      return true;
    }
  };

  const validateConfirmPassword = (confirm: string, password: string) => {
    if (confirm && confirm !== password) {
      setConfirmPasswordError("Passwords do not match");
      return false;
    } else {
      setConfirmPasswordError("");
      return true;
    }
  };

  const handleNewPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewPassword(value);
    validatePassword(value);
    validateConfirmPassword(confirmPassword, value);
  };

  const handleConfirmPasswordChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value;
    setConfirmPassword(value);
    validateConfirmPassword(value, newPassword);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const isPasswordValid = validatePassword(newPassword);
    const isConfirmValid = validateConfirmPassword(
      confirmPassword,
      newPassword,
    );

    if (!isPasswordValid || !isConfirmValid) {
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API}/auth/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token,
            new_password: newPassword,
          }),
        },
      );

      if (res.ok) {
        setSuccess(
          "Password reset successful! You can now login with your new password.",
        );
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      } else {
        const errorData = await res.json();
        setError(errorData.detail || "Failed to reset password");
      }
    } catch (error) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!tokenValid && error) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-linear-to-br from-slate-950 via-red-950 to-slate-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <div className="bg-slate-900/40 backdrop-blur-xl rounded-3xl border border-red-500/50 shadow-2xl p-8">
            <div className="text-center space-y-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/50"
              >
                <AlertTriangle className="w-10 h-10 text-red-400" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Invalid Link
                </h2>
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <p className="text-red-300">{error}</p>
                </div>
              </div>
              <Link href="/forgot-password">
                <Button className="w-full bg-linear-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700">
                  Request New Reset Link
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-linear-to-br from-slate-950 via-emerald-950 to-slate-950">
      {/* Animated gradient */}
      <motion.div
        className="absolute inset-0 opacity-30"
        animate={{
          background: [
            "radial-gradient(circle at 20% 50%, rgba(16, 185, 129, 0.3) 0%, transparent 50%)",
            "radial-gradient(circle at 80% 50%, rgba(5, 150, 105, 0.3) 0%, transparent 50%)",
            "radial-gradient(circle at 50% 80%, rgba(52, 211, 153, 0.3) 0%, transparent 50%)",
            "radial-gradient(circle at 20% 50%, rgba(16, 185, 129, 0.3) 0%, transparent 50%)",
          ],
        }}
        transition={{ duration: 12, repeat: Infinity }}
      />

      {/* Floating Shapes */}
      <motion.div
        className="absolute top-20 right-20 w-32 h-32 bg-linear-to-br from-emerald-500/20 to-teal-500/20 rounded-full blur-3xl"
        animate={floatingShapes.shape1}
      />
      <motion.div
        className="absolute bottom-32 left-32 w-40 h-40 bg-linear-to-br from-green-500/20 to-emerald-500/20 rounded-full blur-3xl"
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
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-br from-emerald-500 to-teal-500 mb-4 shadow-2xl shadow-emerald-500/50"
              whileHover={{ scale: 1.1, rotate: -5 }}
            >
              <Shield className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-4xl font-bold bg-linear-to-r from-white via-emerald-200 to-teal-200 bg-clip-text text-transparent">
              Reset Password
            </h1>
            <p className="mt-2 text-slate-400">
              Set a new password for{" "}
              <span className="text-emerald-400 font-medium">{email}</span>
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
              <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-emerald-500/20 via-transparent to-teal-500/20 opacity-50" />
              <div className="relative z-10">
                {/* Success State */}
                {success && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center space-y-6"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 0.2 }}
                      className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50"
                    >
                      <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                    </motion.div>
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-3">
                        Password Reset!
                      </h3>
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                        <p className="text-sm text-emerald-300">{success}</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => router.push("/login")}
                      className="w-full bg-linear-to-br from-emerald-600 to-teal-600"
                    >
                      Go to Login <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </motion.div>
                )}

                {/* Form State */}
                {!success && (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-red-500/10 border border-red-500/50 text-red-300 px-4 py-3 rounded-xl text-sm"
                      >
                        {error}
                      </motion.div>
                    )}

                    {/* New Password */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        New Password
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                          <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-emerald-400 transition-colors" />
                        </div>
                        <PasswordInput
                          id="newPassword"
                          name="newPassword"
                          required
                          placeholder="••••••••"
                          value={newPassword}
                          onChange={handleNewPasswordChange}
                          error={!!passwordError && newPassword.length > 0}
                          className="block w-full pl-11 pr-12 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>

                      {/* Password Strength */}
                      {newPassword && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">
                              Password Strength
                            </span>
                            <span
                              className={`text-xs font-medium ${passwordStrength.color.replace("bg-", "text-")}`}
                            >
                              {passwordStrength.label}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map((level) => (
                              <div
                                key={level}
                                className={`h-1 flex-1 rounded-full transition-all ${
                                  level <= passwordStrength.strength
                                    ? passwordStrength.color
                                    : "bg-slate-700"
                                }`}
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {/* Requirements */}
                      <div className="mt-3 space-y-1.5">
                        {[
                          {
                            met: newPassword.length >= 8,
                            text: "At least 8 characters",
                          },
                          {
                            met: /[0-9]/.test(newPassword),
                            text: "One number",
                          },
                          {
                            met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
                              newPassword,
                            ),
                            text: "One symbol",
                          },
                        ].map((req, i) => (
                          <div key={i} className="flex items-center gap-2">
                            {req.met ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-600" />
                            )}
                            <span
                              className={`text-xs ${req.met ? "text-emerald-400" : "text-slate-500"}`}
                            >
                              {req.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>

                    {/* Confirm Password */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Confirm Password
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                          <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-emerald-400 transition-colors" />
                        </div>
                        <PasswordInput
                          id="confirmPassword"
                          name="confirmPassword"
                          required
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={handleConfirmPasswordChange}
                          error={
                            !!confirmPasswordError && confirmPassword.length > 0
                          }
                          className="block w-full pl-11 pr-12 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>
                      {confirmPasswordError && confirmPassword.length > 0 && (
                        <p className="mt-2 text-xs text-red-400">
                          {confirmPasswordError}
                        </p>
                      )}
                    </motion.div>

                    {/* Submit */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="pt-2"
                    >
                      <motion.button
                        type="submit"
                        disabled={isLoading}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 px-6 py-3 font-semibold text-white shadow-2xl hover:shadow-emerald-500/50 disabled:opacity-50"
                      >
                        {isLoading ? "Resetting..." : "Reset Password"}
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
