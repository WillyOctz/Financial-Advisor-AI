"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, MotionProps } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  keyof MotionProps
> {
  showToggle?: boolean;
  error?: boolean;
}

export default function PasswordInput({
  showToggle = true,
  error = false,
  className = "",
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <motion.input
        type={showPassword ? "text" : "password"}
        className={className}
        {...props}
      />
      {showToggle && (
        <motion.button
          type="button"
          className="absolute inset-y-0 right-0 pr-3 flex items-center z-20 group"
          onClick={() => setShowPassword(!showPassword)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          tabIndex={-1}
        >
          <AnimatePresence mode="wait" initial={false}>
            {showPassword ? (
              <motion.div
                key="eyeoff"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                transition={{ duration: 0.2 }}
              >
                <EyeOff className="h-5 w-5 text-slate-400 group-hover:text-fuchsia-400 transition-colors" />
              </motion.div>
            ) : (
              <motion.div
                key="eye"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                transition={{ duration: 0.2 }}
              >
                <Eye className="h-5 w-5 text-slate-400 group-hover:text-violet-400 transition-colors" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      )}
    </div>
  );
}
