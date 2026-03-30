"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api/client";
import { useUser } from "@/lib/hooks/useUser";
import { ArrowLeft } from "lucide-react";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "zh", label: "中文 (Chinese)" },
  { code: "ms", label: "Bahasa Melayu" },
  { code: "ar", label: "العربية (Arabic)" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "ja", label: "日本語 (Japanese)" },
];

type ToastType = "success" | "error";
interface Toast {
  message: string;
  type: ToastType;
}

export default function SettingsPage() {
  const { user } = useUser();

  // Language
  const [language, setLanguage] = useState("en");
  const [langSaved, setLangSaved] = useState(false);
  const [langLoading, setLangLoading] = useState(false);

  // 2FA
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFAMethod, setTwoFAMethod] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [step, setStep] = useState<"idle" | "scan" | "done">("idle");
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [disableConfirm, setDisableConfirm] = useState(false);

  // Toast
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (message: string, type: ToastType = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!user) return;

    const loadPreferences = async () => {
      try {
        const res = await apiClient.get("/users/preferences");
        setLanguage(res.data.language ?? "en");
        setTwoFAEnabled(res.data.two_factor_enabled ?? false);
        setTwoFAMethod(res.data.two_factor_method ?? null);
      } catch (err: any) {
        showToast(
          err.response?.data?.detail || "Failed to load preferences.",
          "error",
        );
      }
    };

    loadPreferences();
  }, [user]);

  const handleSaveLanguage = async () => {
    setLangLoading(true);
    try {
      await apiClient.patch("/users/preferences", { language });
      setLangSaved(true);
      showToast("Language preference saved.");
      setTimeout(() => setLangSaved(false), 2500);
    } catch (err: any) {
      showToast(
        err.response?.data?.detail || "Failed to save language.",
        "error",
      );
    } finally {
      setLangLoading(false);
    }
  };

  const handleToggle2FA = async () => {
    if (twoFAEnabled) {
      setDisableConfirm(true);
      return;
    }

    // Start setup — fetch QR code + secret from backend
    setTwoFALoading(true);
    try {
      const res = await apiClient.post("/2fa/setup", { method: "app" });
      setQrCodeUrl(res.data.qr_code_url);
      setBackupCodes(res.data.backup_codes ?? []);
      setStep("scan");
    } catch (err: any) {
      showToast(
        err.response?.data?.detail || "Failed to start 2FA setup.",
        "error",
      );
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleVerify2FA = async () => {
    const code = otpDigits.join("");
    if (code.length < 6) {
      showToast("Please enter the full 6-digit code.", "error");
      return;
    }

    setTwoFALoading(true);
    try {
      await apiClient.post("/2fa/verify-setup", { code });
      setTwoFAEnabled(true);
      setStep("done");
      setOtpDigits(["", "", "", "", "", ""]);
      setQrCodeUrl(null);
      showToast("Two-factor authentication enabled.");
      setTimeout(() => setStep("idle"), 2000);
    } catch (err: any) {
      showToast(
        err.response?.data?.detail || "Invalid code. Please try again.",
        "error",
      );
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleConfirmDisable = async () => {
    setTwoFALoading(true);
    try {
      // your /2fa/disable endpoint requires the user's password
      // but since this settings page doesn't collect password inline,
      // we re-use the TwoFactorDisableRequest schema — password is prompted
      // via the modal (see disablePassword state below)
      await apiClient.post("/2fa/disable", { password: disablePassword });
      setTwoFAEnabled(false);
      setTwoFAMethod(null);
      setStep("idle");
      setDisableConfirm(false);
      setDisablePassword("");
      showToast("Two-factor authentication disabled.");
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Incorrect password.", "error");
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleOtpDigit = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otpDigits];
    next[index] = value;
    setOtpDigits(next);
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const handleCancelSetup = () => {
    setStep("idle");
    setQrCodeUrl(null);
    setBackupCodes([]);
    setOtpDigits(["", "", "", "", "", ""]);
  };

  const [disablePassword, setDisablePassword] = useState("");

  const returnToHome = () => {
    window.location.href = "/dashboard"
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg text-sm shadow-md transition-all duration-300 ${
            toast.type === "success"
              ? "bg-white border border-gray-200 text-gray-800"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="max-w-xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-9 flex text-2xl gap-1 cursor-pointer" onClick={returnToHome}>
          <ArrowLeft className="w-8 h-8"/>Back
        </div>
        <div className="mb-10">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
            Settings
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage your preferences and security
          </p>
        </div>

        {/* ── Language ── */}
        <section className="mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-gray-50">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-widest">
                Language
              </h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-2">
                  Display language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all cursor-pointer appearance-none"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleSaveLanguage}
                disabled={langLoading}
                className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50 ${
                  langSaved
                    ? "bg-green-50 text-green-600 border border-green-200"
                    : "bg-gray-900 text-white hover:bg-gray-700"
                }`}
              >
                {langLoading ? "Saving…" : langSaved ? "✓ Saved" : "Save"}
              </button>
            </div>
          </div>
        </section>

        {/* ── 2FA ── */}
        <section className="mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-gray-50">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-widest">
                Two-Factor Authentication
              </h2>
            </div>

            {/* Toggle row */}
            <div className="px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-800 font-medium">
                    Authenticator app
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {twoFAEnabled
                      ? "Your account is protected with 2FA."
                      : "Add an extra layer of security to your account."}
                  </p>
                </div>
                <button
                  onClick={handleToggle2FA}
                  disabled={twoFALoading || step === "scan"}
                  className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                    twoFAEnabled ? "bg-gray-900" : "bg-gray-200"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <span
                    className={`inline-block w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                      twoFAEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {twoFAEnabled && step !== "done" && (
                <div className="mt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    Enabled
                  </span>
                </div>
              )}
            </div>

            {/* Setup flow */}
            {step === "scan" && (
              <div className="px-6 pb-6 space-y-5 border-t border-gray-50 pt-5">
                {/* Step 1 — QR */}
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-3">
                    1. Scan this QR code with your authenticator app
                  </p>
                  <div className="w-40 h-40 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center mx-auto overflow-hidden">
                    {qrCodeUrl ? (
                      <img
                        src={qrCodeUrl}
                        alt="2FA QR Code"
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <p className="text-xs text-gray-400">Loading…</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 text-center mt-2">
                    Use Google Authenticator, Authy, or any TOTP app
                  </p>
                </div>

                {/* Step 2 — OTP */}
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-3">
                    2. Enter the 6-digit code shown in your app
                  </p>
                  <div className="flex gap-2 justify-center">
                    {otpDigits.map((digit, i) => (
                      <input
                        key={i}
                        id={`otp-${i}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpDigit(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className="w-10 h-12 text-center text-lg font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
                      />
                    ))}
                  </div>
                </div>

                {/* Backup codes preview */}
                {backupCodes.length > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                    <p className="text-xs font-medium text-amber-700 mb-2">
                      Save these backup codes — you won't see them again
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      {backupCodes.map((code) => (
                        <span
                          key={code}
                          className="text-xs font-mono text-amber-800 bg-amber-100 px-2 py-1 rounded"
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleCancelSetup}
                    disabled={twoFALoading}
                    className="flex-1 py-2.5 rounded-xl text-sm text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleVerify2FA}
                    disabled={twoFALoading || otpDigits.join("").length < 6}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {twoFALoading ? "Verifying…" : "Verify & Enable"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Disable 2FA modal ── */}
      {disableConfirm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 w-full max-w-sm">
            <h3 className="text-base font-semibold text-gray-900">
              Disable 2FA?
            </h3>
            <p className="text-sm text-gray-400 mt-1.5 mb-4">
              Your account will be less secure. Enter your password to confirm.
            </p>
            <input
              type="password"
              placeholder="Your password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirmDisable()}
              className="w-full text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDisableConfirm(false);
                  setDisablePassword("");
                }}
                disabled={twoFALoading}
                className="flex-1 py-2.5 rounded-xl text-sm text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-all"
              >
                Keep enabled
              </button>
              <button
                onClick={handleConfirmDisable}
                disabled={twoFALoading || !disablePassword}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {twoFALoading ? "Disabling…" : "Disable"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
