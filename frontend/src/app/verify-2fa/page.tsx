"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { Shield, AlertTriangle, Loader2, ArrowLeft } from "lucide-react";

export default function Verify2FAPage() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [partialToken, setPartialToken] = useState("");
  const [method, setMethod] = useState<"app" | "email" | "sms" | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    // get partial token from localstorage
    const token = localStorage.getItem("partial_token");
    const storedMethod = localStorage.getItem("2fa_method") as "app" | "email" | "sms" | null;

    if (!token) {
      router.push("/login");
      return;
    }
    setPartialToken(token);

    if (storedMethod) {
      setMethod(storedMethod)
    }
  }, [router]);

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
        partial_token: partialToken,
        code: useBackupCode ? undefined : codeToVerify,
        backup_code: useBackupCode ? codeToVerify : undefined,
      });

      // store the full access token
      const { access_token, user } = res.data;

      // save to localstorage and cookies
      localStorage.setItem("token", access_token);
      localStorage.setItem("user", JSON.stringify(user));
      document.cookie = `token=${access_token}; path=/; max-age=${30 * 24 * 60 * 60}`;

      // clear partial token
      localStorage.removeItem("partial_token");

      setSuccess("Verification successful! Redirecting...");

      // redirect to dashboard
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
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
        partial_token: partialToken,
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
    router.push("/login");
  };

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
            Enter the verification code to complete your login
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
                    Enter the code from your authenticator app, email, or SMS
                  </p>
                </div>

                {/* Resend Code Button */}
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
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
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
              className="w-full text-sm text-gray-600 hover:text-gray-900"
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
              className="w-full text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-2"
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
