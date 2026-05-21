"use client";

import React, { useState } from "react";
import { motion, Variants } from "framer-motion";
import {
  Mail,
  Bell,
  User,
  Shield,
  Settings as SettingsIcon,
  ArrowBigLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import PasswordInput from "@/components/ui/password-input";
import TwoFactorSettings from "@/components/forms/TwoFactorSetting";
import CurrencySwitcher from "@/components/forms/CurrencySwitcher";
import Link from "next/link";
import ProfileForm from "@/components/forms/ProfileForm";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "../../../contexts/AuthContexts";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
} satisfies Variants;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
} satisfies Variants;

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("security");
  const [darkMode, setDarkMode] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  
  // Password change states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  const { refreshUser } = useAuth();

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "security", label: "Security", icon: Shield },
    // { id: "notifications", label: "Notifications", icon: Bell },
    { id: "preferences", label: "Preferences", icon: SettingsIcon },
  ];

  /**
   * Handle password change submission
   * 
   * Flow:
   * 1. Validate inputs (fields not empty, passwords match)
   * 2. Send request to backend API
   * 3. Handle response (success or error)
   * 4. Clear form and show feedback
   */
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous messages
    setPasswordError("");
    setPasswordSuccess("");
    
    // Step 1: Frontend validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }
    
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long");
      return;
    }
    
    try {
      setIsChangingPassword(true);
      
      // Step 2: Send request to backend
      const response = await apiClient.post("/users/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      
      // Step 3: Handle success
      if (response.data.success) {
        setPasswordSuccess(response.data.message);
        
        // Clear form fields
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        
        // Optional: Refresh user data
        await refreshUser();
      }
      
    } catch (error: any) {
      // Step 4: Handle errors
      console.error("Password change error:", error);
      
      if (error.response?.data?.detail) {
        // Backend validation error (e.g., wrong current password)
        if (Array.isArray(error.response.data.detail)) {
          // Pydantic validation errors
          setPasswordError(
            error.response.data.detail
              .map((err: any) => err.msg)
              .join(", ")
          );
        } else {
          // Custom error message from backend
          setPasswordError(error.response.data.detail);
        }
      } else {
        setPasswordError("Failed to change password. Please try again.");
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-950 via-indigo-950 to-slate-950 relative overflow-hidden">
      {/* Animated background */}
      <motion.div
        className="absolute inset-0 opacity-20"
        animate={{
          background: [
            "radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.3) 0%, transparent 50%)",
            "radial-gradient(circle at 80% 50%, rgba(139, 92, 246, 0.3) 0%, transparent 50%)",
            "radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.3) 0%, transparent 50%)",
          ],
        }}
        transition={{ duration: 10, repeat: Infinity }}
      />
      <div className="relative max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700/50 hover:border-slate-600/50 transition-all duration-200"
            >
              <ArrowBigLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-4xl font-bold bg-linear-to-r from-white via-indigo-200 to-purple-200 bg-clip-text text-transparent">
              Settings
            </h1>
          </div>
          <p className="text-slate-400 pl-14">
            Manage your account settings and preferences
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Tabs Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <motion.button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    whileHover={{ scale: 1.02, x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all mb-1 ${
                      activeTab === tab.id
                        ? "bg-linear-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/50"
                        : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* Content Area */}
          <div className="lg:col-span-3">
            <motion.div
              key={activeTab}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl p-6"
            >
              {/* Profile Tab */}
              {activeTab === "profile" && (
                <motion.div variants={itemVariants}>
                  <ProfileForm />
                </motion.div>
              )}

              {/* Security Tab */}
              {activeTab === "security" && (
                <motion.div variants={itemVariants} className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                      Security Settings
                    </h2>
                    <p className="text-slate-400">
                      Manage your password and security preferences
                    </p>
                  </div>

                  {/* Change Password Form */}
                  <form onSubmit={handlePasswordChange} className="bg-slate-800/30 rounded-xl p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-white">
                      Change Password
                    </h3>
                    
                    {/* Error Message */}
                    {passwordError && (
                      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                        {passwordError}
                      </div>
                    )}
                    
                    {/* Success Message */}
                    {passwordSuccess && (
                      <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-3 text-green-400 text-sm">
                        {passwordSuccess}
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Current Password
                      </label>
                      <PasswordInput
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        New Password
                      </label>
                      <PasswordInput
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Must be at least 8 characters with uppercase and digit
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Confirm New Password
                      </label>
                      <PasswordInput
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    
                    <Button 
                      type="submit"
                      disabled={isChangingPassword}
                      className="bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50"
                    >
                      {isChangingPassword ? "Updating..." : "Update Password"}
                    </Button>
                  </form>

                  {/* Two-Factor Authentication */}
                  <TwoFactorSettings />
                </motion.div>
              )}

              {/* Notifications Tab */}
              {activeTab === "notifications" && (
                <motion.div variants={itemVariants} className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                      Notification Preferences
                    </h2>
                    <p className="text-slate-400">
                      Choose how you want to be notified
                    </p>
                  </div>

                  <div className="space-y-4">
                    {[
                      {
                        icon: Mail,
                        title: "Email Notifications",
                        description: "Receive updates via email",
                        enabled: emailNotifications,
                        setter: setEmailNotifications,
                      },
                      {
                        icon: Bell,
                        title: "Push Notifications",
                        description:
                          "Receive push notifications on your device",
                        enabled: pushNotifications,
                        setter: setPushNotifications,
                      },
                    ].map((notif, i) => {
                      const Icon = notif.icon;
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                              <Icon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-white">
                                {notif.title}
                              </h3>
                              <p className="text-sm text-slate-400">
                                {notif.description}
                              </p>
                            </div>
                          </div>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => notif.setter(!notif.enabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              notif.enabled ? "bg-indigo-600" : "bg-slate-700"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                notif.enabled
                                  ? "translate-x-6"
                                  : "translate-x-1"
                              }`}
                            />
                          </motion.button>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Preferences Tab */}
              {activeTab === "preferences" && (
                <motion.div variants={itemVariants} className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                      App Preferences
                    </h2>
                    <p className="text-slate-400">Customize your experience</p>
                  </div>

                  {/* Currency Switcher */}
                  <CurrencySwitcher />
                </motion.div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}