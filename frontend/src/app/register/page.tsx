"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useMotionValue, useTransform, Variants } from "framer-motion";
import { useAuth } from "../../../contexts/AuthContexts";
import PasswordInput from "@/components/ui/password-input";
import { toast, Toaster } from "react-hot-toast";
import {
  ArrowRight,
  Sparkles,
  Lock,
  Mail,
  User,
  CheckCircle2,
  Circle,
  DollarSign,
  User2,
  UserCircle2Icon,
} from "lucide-react";

// Floating animation variants
const floatingShapes = {
  shape1: {
    y: [0, -40, 0],
    x: [0, 30, 0],
    rotate: [0, 180, 0],
    transition: {
      duration: 9,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
  shape2: {
    y: [0, 35, 0],
    x: [0, -20, 0],
    rotate: [0, -90, 0],
    transition: {
      duration: 11,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
  shape3: {
    y: [0, -30, 0],
    x: [0, 25, 0],
    scale: [1, 1.3, 1],
    transition: {
      duration: 8,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
} satisfies Variants;

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const router = useRouter();
  const { login } = useAuth();

  // 3D card tilt effect
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

  const passwordStrength = getPasswordStrength(formData.password);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData({
      ...formData,
      [name]: value,
    });

    // Validate password in real-times when password field changes
    if (name === "password") {
      if (value.length < 8 || !passwordRegex.test(value)) {
        setPasswordError(
          "Password must contain at least one number,one symbol and more than 8 characters",
        );
      } else {
        setPasswordError("");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Validate password before submission
    if (!passwordRegex.test(formData.password)) {
      setPasswordError(
        "Password must contain at least one number and one symbol",
      );
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        // show notification to allow user to know
        toast.success(
          "Registration successful! Please check your email inbox to verify your account.",
        );

        // wait for 3 seconds
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Auto login after successful registration
        const loginRes = await fetch(
          `${process.env.NEXT_PUBLIC_API}/auth/login`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
            }),
          },
        );

        if (loginRes.ok) {
          const data = await loginRes.json();
          login(data.access_token, data.user, false);
          router.push("/dashboard");
        } else {
          router.push("/login");
        }
      } else {
        const errorData = await res.json();
        setError(errorData.detail || "Registration failed");
      }
    } catch (error) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-linear-to-br from-slate-950 via-indigo-950 to-slate-950">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 5000,
          style: {
            background: "rgba(15, 23, 42, 0.95)",
            backdropFilter: "blur(12px)",
            color: "#fff",
            border: "1px solid rgba(139, 92, 246, 0.3)",
            borderRadius: "16px",
            padding: "16px 24px",
          },
          success: {
            duration: 6000,
            iconTheme: {
              primary: "#10B981",
              secondary: "#fff",
            },
          },
        }}
      />

      {/* Animated gradient overlay */}
      <motion.div
        className="absolute inset-0 opacity-30"
        animate={{
          background: [
            "radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.3) 0%, transparent 50%)",
            "radial-gradient(circle at 20% 80%, rgba(236, 72, 153, 0.3) 0%, transparent 50%)",
            "radial-gradient(circle at 50% 50%, rgba(167, 139, 250, 0.3) 0%, transparent 50%)",
            "radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.3) 0%, transparent 50%)",
          ],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      />

      {/* Floating shapes */}
      <motion.div
        className="absolute top-32 right-20 w-32 h-32 bg-linear-to-br from-fuchsia-500/20 to-pink-500/20 rounded-full blur-3xl"
        animate={floatingShapes.shape1}
      />
      <motion.div
        className="absolute bottom-20 left-32 w-40 h-40 bg-linear-to-br from-blue-500/20 to-cyan-500/20 rounded-full blur-3xl"
        animate={floatingShapes.shape2}
      />
      <motion.div
        className="absolute top-1/3 left-20 w-24 h-24 bg-linear-to-br from-violet-500/20 to-purple-500/20 rounded-full blur-3xl"
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
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-br from-fuchsia-500 to-pink-500 mb-4 shadow-2xl shadow-fuchsia-500/50"
              whileHover={{ scale: 1.1, rotate: -5 }}
              whileTap={{ scale: 0.95 }}
            >
              <DollarSign className="w-8 h-8 text-white" />
            </motion.div>
            <motion.h1
              className="text-4xl font-bold bg-linear-to-r from-white via-fuchsia-200 to-pink-200 bg-clip-text text-transparent"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Create Account
            </motion.h1>
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
            {/* Glass card with 3D effect */}
            <div className="relative bg-slate-900/40 backdrop-blur-xl rounded-3xl border border-slate-700/50 shadow-2xl p-8 overflow-hidden">
              {/* Gradient border effect */}
              <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-fuchsia-500/20 via-transparent to-pink-500/20 opacity-50" />

              {/* Shine effect */}
              <motion.div
                className="absolute inset-0 rounded-3xl opacity-0"
                whileHover={{ opacity: 1 }}
                style={{
                  background:
                    "radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255, 255, 255, 0.1) 0%, transparent 50%)",
                }}
              />

              <div className="relative z-10">
                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-500/10 backdrop-blur-sm border border-red-500/50 text-red-300 px-4 py-3 rounded-xl text-sm"
                    >
                      {error}
                    </motion.div>
                  )}

                  {/* Name Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <label
                        htmlFor="first_name"
                        className="block text-sm font-medium text-slate-300 mb-2"
                      >
                        First name
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-4 w-4 text-slate-400 group-focus-within:text-fuchsia-400 transition-colors" />
                        </div>
                        <motion.input
                          whileFocus={{ scale: 1.01 }}
                          id="first_name"
                          name="first_name"
                          type="text"
                          required
                          className="block w-full pl-10 pr-3 py-2.5 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent transition-all duration-200"
                          placeholder="John"
                          value={formData.first_name}
                          onChange={handleChange}
                        />
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <label
                        htmlFor="last_name"
                        className="block text-sm font-medium text-slate-300 mb-2"
                      >
                        Last name
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <UserCircle2Icon className="h-4 w-4 text-slate-400 group-focus-within:text-fuchsia-400 transition-colors" />
                        </div>
                        <motion.input
                          whileFocus={{ scale: 1.01 }}
                          id="last_name"
                          name="last_name"
                          type="text"
                          required
                          className="block w-full pl-10 pr-3 py-2.5 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent transition-all duration-200"
                          placeholder="Wick"
                          value={formData.last_name}
                          onChange={handleChange}
                        />
                      </div>
                    </motion.div>
                  </div>

                  {/* Email Field */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-slate-300 mb-2"
                    >
                      Email Address
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-fuchsia-400 transition-colors" />
                      </div>
                      <motion.input
                        whileFocus={{ scale: 1.01 }}
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        className="block w-full pl-11 pr-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent transition-all duration-200"
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={handleChange}
                      />
                    </div>
                  </motion.div>

                  {/* Password field with strength indicator */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-slate-300 mb-2"
                    >
                      Password
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                        <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-fuchsia-400 transition-colors" />
                      </div>
                      <PasswordInput
                        id="password"
                        name="password"
                        autoComplete="new-password"
                        required
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleChange}
                        error={!!passwordError && formData.password.length > 0}
                        className="block w-full pl-11 pr-12 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent transition-all duration-200"
                      />
                    </div>

                    {/* Password strength indicator */}
                    {formData.password && (
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
                            <motion.div
                              key={level}
                              initial={{ scaleX: 0 }}
                              animate={{ scaleY: 1 }}
                              transition={{ delay: level * 0.1 }}
                              className={`h-1 flex-1 rounded-full ${
                                level <= passwordStrength.strength
                                  ? passwordStrength.color
                                  : "bg-slate-700"
                              }`}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {passwordError && formData.password && (
                      <motion.p
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 text-xs text-red-400"
                      >
                        {passwordError}
                      </motion.p>
                    )}

                    {/* Password Requirements */}
                    <div className="mt-3 space-y-1.5">
                      {[
                        {
                          met: formData.password.length >= 8,
                          text: "At least 8 characters",
                        },
                        {
                          met: /[0-9]/.test(formData.password),
                          text: "One number (0-9)",
                        },
                        {
                          met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
                            formData.password,
                          ),
                          text: "One symbol (!@#$%^&*)",
                        },
                      ].map((req, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.6 + i * 0.1 }}
                          className="flex items-center gap-2"
                        >
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
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Submit Button */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="pt-2"
                  >
                    <motion.button
                      type="submit"
                      disabled={isLoading}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="relative w-full group overflow-hidden rounded-xl bg-linear-to-r from-fuchsia-600 to-pink-600 p-0.5 transition-all duration-300 hover:shadow-2xl hover:shadow-fuchsia-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="relative bg-linear-to-r from-fuchsia-600 to-pink-600 rounded-xl px-6 py-3 transition-all duration-300">
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
                              Creating Account...
                            </>
                          ) : (
                            <>
                              Create Account
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
                  transition={{ delay: 0.8 }}
                  className="relative my-6"
                >
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-700/50"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-slate-900/40 text-slate-400">
                      Already have an account?
                    </span>
                  </div>
                </motion.div>

                {/* Login link */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9 }}
                  className="text-center"
                >
                  <Link href="/login">
                    <motion.span
                      whileHover={{ scale: 1.05 }}
                      className="inline-flex items-center gap-2 text-sm font-medium text-transparent bg-linear-to-r from-fuchsia-400 to-pink-400 bg-clip-text hover:from-fuchsia-300 hover:to-pink-300 transition-all cursor-pointer"
                    >
                      Sign in
                      <ArrowRight className="w-4 h-4 text-fuchsia-400" />
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
