"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "../../../contexts/AuthContexts";
import { Shield, AlertTriangle, Loader2, ArrowLeft } from "lucide-react";

export default function Verify2FAPage() {
  const router = useRouter();
  const {
    complete2FA,
    partialToken: contextPartialToken,
    twoFAMethod,
  } = useAuth();

  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    // check the partial token in the context first
    if (!contextPartialToken) {
      router.push("/login");
    }
  }, [contextPartialToken, router]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    const codeToVerify = useBackupCode ? backupCode : code;

    if (!codeToVerify) {
      setError("Please enter a verification code");
      return;
    }

    if (!useBackupCode && codeToVerify.length !== 6) {
      setError("Code must be 6 digits");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await apiClient.post("/auth/verify-2fa", {
        partial_token: contextPartialToken,
        code: useBackupCode ? undefined : codeToVerify,
        backup_code: useBackupCode ? codeToVerify : undefined,
      });

      const { access_token, user } = res.data;

      // update all the context state
      complete2FA(access_token, user);

      setSuccess("Verification successfull Redirecting...");

      // delay to make it look cool loading state
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    } catch (error: any) {
      setError(
        error.response?.data?.detail ||
          "Invalid verification code. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    try {
      setResendLoading(true);
      setError("");

      await apiClient.post("/auth/resend-2fa-code", {
        partial_token: contextPartialToken,
      });

      setSuccess("New code sent! Check your email/phone.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          "Failed to resend code. Please try logging in again.",
      );
    } finally {
      setResendLoading(false);
    }
  };

  const handleBackToLogin = () => {
    localStorage.removeItem("partial_token");
    localStorage.removeItem("2fa_method");
    router.push("/login");
  };

  if (!contextPartialToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Two-Factor Authentication
          </h1>
          <p className="text-gray-600">
            Enter the verification code{" "}
            {twoFAMethod && `from your ${twoFAMethod}`} to complete your login
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {/* Verification Form */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <form onSubmit={handleVerify}>
            {!useBackupCode ? (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="000000"
                    maxLength={6}
                    className="w-full px-4 py-3 text-2xl tracking-widest text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Enter the code from your{" "}
                    {twoFAMethod || "authenticator app, email, or SMS"}
                  </p>
                </div>

                {/* Resend Code Button - Only show for email/sms */}
                {twoFAMethod && twoFAMethod !== "app" && (
                  <div className="mb-6 text-center">
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={resendLoading}
                      className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                    >
                      {resendLoading
                        ? "Sending..."
                        : "Didn't receive a code? Resend"}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Backup Code
                  </label>
                  <input
                    type="text"
                    value={backupCode}
                    onChange={(e) =>
                      setBackupCode(
                        e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                      )
                    }
                    placeholder="XXXXXXXX"
                    className="w-full px-4 py-3 text-xl tracking-wider text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Enter one of your backup codes
                  </p>
                </div>
              </>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || (!code && !backupCode)}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify & Continue"
              )}
            </button>
          </form>

          {/* Toggle Backup Code */}
          <div className="mt-6 pt-6 border-t">
            <button
              type="button"
              onClick={() => {
                setUseBackupCode(!useBackupCode);
                setCode("");
                setBackupCode("");
                setError("");
              }}
              className="w-full text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              {useBackupCode
                ? "Use verification code instead"
                : "Lost access? Use a backup code"}
            </button>
          </div>

          {/* Back to Login */}
          <div className="mt-4">
            <button
              type="button"
              onClick={handleBackToLogin}
              className="w-full text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </button>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>Security Tip:</strong> Never share your verification codes
            with anyone. We will never ask for your 2FA code.
          </p>
        </div>
      </div>
    </div>
  );
}
