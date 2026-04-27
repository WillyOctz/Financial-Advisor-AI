"use client";

import { useState, useEffect } from "react";
import {
  twoFactorAPI,
  TwoFactorStatus,
  TwoFactorSetupResponse,
} from "@/lib/api/twoFactor";
import { useUser } from "@/lib/hooks/useUser";
import {
  Shield,
  Smartphone,
  Mail,
  MessageSquare,
  Key,
  Download,
  AlertTriangle,
  Check,
} from "lucide-react";

export default function TwoFactorSettings() {
  const { user, isAuthenticated } = useUser();

  // state
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupStep, setSetupStep] = useState<
    "choose" | "verify" | "complete" | null
  >(null);
  const [selectedMethod, setSelectedMethod] = useState<
    "app" | "email" | "sms" | null
  >(null);
  const [setupData, setSetupData] = useState<TwoFactorSetupResponse | null>(
    null,
  );
  const [verificationCode, setVerificationCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Load 2Fa status on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadStatus();
    }
  }, [isAuthenticated]);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const data = await twoFactorAPI.getStatus();
      setStatus(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load 2FA status");
    } finally {
      setLoading(false);
    }
  };

  const handleStartSetup = (method: "app" | "email" | "sms") => {
    setSelectedMethod(method);
    setSetupStep("choose");
    setError("");
    setSuccess("");
  };

  const handleSetup = async () => {
    if (!selectedMethod) return;

    // validate phone number for SMS
    if (selectedMethod === "sms" && !phoneNumber) {
      setError("Please enter a phone number");
      return;
    }

    if (selectedMethod === "sms" && !phoneNumber.startsWith("+")) {
      setError("Phone number must include country code (e.g., +1234567890)");
      return;
    }

    try {
      setActionLoading(true);
      setError("");

      const data = await twoFactorAPI.setup(
        selectedMethod,
        selectedMethod === "sms" ? phoneNumber : undefined,
      );

      setSetupData(data);
      setSetupStep("verify");

      if (selectedMethod !== "app") {
        setSuccess(
          data.message ||
            "Verification code sent! Check your " + selectedMethod,
        );
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to setup 2FA");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }

    try {
      setActionLoading(true);
      setError("");

      const result = await twoFactorAPI.verifySetup(verificationCode);

      setSuccess("2FA enabled succesfully!");
      setSetupStep("complete");
      setShowBackupCodes(true);

      // reload status
      await loadStatus();

      // reset after 3 seconds
      setTimeout(() => {
        setSetupStep(null);
        setSelectedMethod(null);
        setSetupData(null);
        setVerificationCode("");
        setPhoneNumber("");
        setShowBackupCodes(false);
      }, 5000);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Invalid verification code");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResendCode = async () => {
    try {
      setActionLoading(true);
      setError("");

      const result = await twoFactorAPI.resendSetupCode();
      setSuccess(result.message);

      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to resend code");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!disablePassword) {
      setError("Please enter your password to disable 2FA");
      return;
    }

    try {
      setActionLoading(true);
      setError("");

      await twoFactorAPI.disable(disablePassword);

      setSuccess("2FA disabled successfully!");
      setDisablePassword("");

      // Reload Status
      await loadStatus();

      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          "Failed to disable 2FA. Check your password.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateBackupCodes = async () => {
    try {
      setActionLoading(true);
      setError("");

      const result = await twoFactorAPI.generateBackupCodes();
      setSetupData({ ...setupData!, backup_codes: result.backup_codes });
      setShowBackupCodes(true);
      setSuccess(result.message);

      // reload status
      await loadStatus();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to generate backup codes");
    } finally {
      setActionLoading(false);
    }
  };

  const downloadBackupCodes = () => {
    if (!setupData?.backup_codes) return;

    const text = `Financial Advisor AI - Backup Codes\n\n${setupData.backup_codes.join("\n")}\n\nSave these codes in a secure location. Each code can only be used once.`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl flex items-center gap-3 text-white font-bold">
          <Shield className="w-8 h-8 text-blue-600" />
          Two Factor Authentication
        </h1>
        <p className="text-gray-600 mt-2">
          Add an extra layer of security to your account
        </p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrinl-0 mt-0.5" />
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <Check className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {/* Current Status */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Current Status</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600">
              Two Factor Authentication is{" "}
              <span
                className={
                  status?.enabled
                    ? "text-green-600 font-semibold"
                    : "text-gray-500 font-semibold"
                }
              >
                {status?.enabled ? "ENABLED" : "DISABLED"}
              </span>
            </p>
            {status?.enabled && status.method && (
              <p className="text-sm text-gray-500 mt-1">
                Method: {status.method.toUpperCase()}
                {status.method === "sms" && status.phone_number && (
                  <span>• {status.phone_number}</span>
                )}
              </p>
            )}
            {status?.enabled && (
              <p className="text-sm text-gray-500">
                Backup codes remaining: {status.remaining_backup_codes}
              </p>
            )}
          </div>
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center ${status?.enabled ? "bg-green-100" : "bg-gray-100"}`}
          >
            <Shield
              className={`w-8 h-8 ${status?.enabled ? "text-green-600" : "text-gray-400"}`}
            />
          </div>
        </div>
      </div>

      {/* Setup Flow */}
      {!status?.enabled && !setupStep && (
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Enable Two-Factor Authentication
          </h2>
          <p className="text-gray-600 mb-6">
            Choose your preferred authentication method:
          </p>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Authenticator App */}
            <button
              onClick={() => handleStartSetup("app")}
              className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
            >
              <Smartphone className="w-10 h-10 text-gray-600 group-hover:text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Authenticator App</h3>
              <p className="text-sm text-gray-600">
                Use Google Authenticator, Authy, or others
              </p>
              <div className="mt-3 text-xs text-gray-500">
                <p className="font-medium text-green-600">✓ Most secure</p>
                <p>✓ Works offline</p>
              </div>
            </button>

            {/* Email */}
            <button
              onClick={() => handleStartSetup("email")}
              className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
            >
              <Mail className="w-10 h-10 text-gray-600 group-hover:text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Email</h3>
              <p className="text-sm text-gray-600">Receive codes via email</p>
              <div className="mt-3 text-xs text-gray-500">
                <p className="font-medium text-blue-600">✓ Easy to use</p>
                <p>✓ No extra app needed</p>
              </div>
            </button>

            {/* SMS */}
            <button
              onClick={() => handleStartSetup("sms")}
              className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
            >
              <MessageSquare className="w-10 h-10 text-gray-600 group-hover:text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">SMS</h3>
              <p className="text-sm text-gray-600">
                Receive codes via text message
              </p>
              <div className="mt-3 text-xs text-gray-500">
                <p className="font-medium text-blue-600">✓ Convenient</p>
                <p>✓ Works on any phone</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Setup: Method Configuration */}
      {setupStep === "choose" && selectedMethod && (
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Setup{" "}
            {selectedMethod === "app"
              ? "Authenticator App"
              : selectedMethod.toUpperCase()}{" "}
            2FA
          </h2>

          {selectedMethod === "sms" && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone number (with country code)
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1 23456 7890"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Format: +[country code] [number]
              </p>
            </div>
          )}

          {selectedMethod === "email" && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                A verification code will be sent to:{" "}
                <strong>{user?.email}</strong>
              </p>
            </div>
          )}

          {selectedMethod === "app" && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                You'll need an authenticator app like Google Authenticator or
                Authy to scan a QR code.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSetup}
              disabled={
                actionLoading || (selectedMethod === "sms" && !phoneNumber)
              }
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {actionLoading ? "Setting up..." : "Continue"}
            </button>
            <button
              onClick={() => {
                setSetupStep(null);
                setSelectedMethod(null);
                setPhoneNumber("");
              }}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Setup: Verify Code */}
      {setupStep === "verify" && setupData && (
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Verify Setup</h2>

          {/* QR Code for App */}
          {selectedMethod === "app" && setupData.qr_code_url && (
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-4">
                Scan this QR code with your authenticator app:
              </p>
              <div className="flex justify-center mb-4">
                <img
                  src={setupData.qr_code_url}
                  alt="QR Code"
                  className="border-4 border-gray-200 rounded-lg"
                />
              </div>
              <details className="text-sm text-gray-600">
                <summary className="cursor-pointer font-medium">
                  Can't scan? Enter manually
                </summary>
                <div className="mt-2 p-3 bg-gray-50 rounded border font-mono text-xs break-all">
                  {setupData.secret}
                </div>
              </details>
            </div>
          )}

          {/* Verification Code Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter the 6-digit code
              {selectedMethod !== "app" && ` from your ${selectedMethod}`}
            </label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) =>
                setVerificationCode(
                  e.target.value.replace(/\D/g, "").slice(0, 6),
                )
              }
              placeholder="000000"
              maxLength={6}
              className="w-full px-4 py-3 text-2xl tracking-widest text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            />
          </div>

          {/* Resend for email/SMS */}
          {selectedMethod !== "app" && (
            <div className="mb-6 text-center">
              <button
                onClick={handleResendCode}
                disabled={actionLoading}
                className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
              >
                Didn't receive the code? Resend
              </button>
            </div>
          )}

          {/* Backup Codes Preview */}
          {setupData.backup_codes && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Key className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800 mb-2">
                    Save your backup codes
                  </p>
                  <p className="text-sm text-yellow-700">
                    You'll see your backup codes after verification. Save them
                    in a secure location.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleVerify}
              disabled={actionLoading || verificationCode.length !== 6}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {actionLoading ? "Verifying..." : "Verify & Enable"}
            </button>
            <button
              onClick={() => {
                setSetupStep("choose");
                setVerificationCode("");
              }}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Setup: Complete with Backup Codes */}
      {setupStep === "complete" &&
        showBackupCodes &&
        setupData?.backup_codes && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-green-600 mb-2">
                2FA Enabled!
              </h2>
              <p className="text-gray-600">Your account is now more secure</p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
                <Key className="w-5 h-5" />
                Save your Backup Codes
              </h3>
              <p className="text-sm text-yellow-700 mb-4">
                Store these codes in a safe place. Each code can only be used
                once to access your account if you lose access to your 2FA
                method.
              </p>

              <div className="bg-white rounded border border-yellow-300 p-4 mb-4">
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {setupData.backup_codes.map((code, index) => (
                    <div
                      key={index}
                      className="p-2 bg-gray-50 rounded text-center"
                    >
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={downloadBackupCodes}
                className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      {/* Manage 2FA */}
      {status?.enabled && !setupStep && (
        <div className="space-y-6">
          {/* Backup Codes Management */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4">Backup Codes</h2>
            <p className="text-gray-600 mb-4">
              You have <strong>{status.remaining_backup_codes}</strong> backup
              code(s) remaining.
            </p>
            <button
              onClick={handleGenerateBackupCodes}
              disabled={actionLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
            >
              {actionLoading ? "Generating..." : "Generate new Backup Codes"}
            </button>
            <p className="text-xs text-gray-500 mt-2">
              This will invalidate all existing backup codes
            </p>
          </div>

          {/* Show Backup Codes that just Generated */}
          {showBackupCodes && setupData?.backup_codes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="font-semibold text-yellow-800 mb-3">
                Your New Backup Codes
              </h3>
              <div className="bg-white rounded border border-yellow-300 p-4 mb-4">
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {setupData.backup_codes.map((code, index) => (
                    <div
                      key={index}
                      className="p-2 bg-gray-50 rounded text-center"
                    >
                      {code}
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={downloadBackupCodes}
                className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Backup Codes
              </button>
            </div>
          )}

          {/* Disable 2FA */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-4 text-red-600">
              Disable Two-Factor Authentication
            </h2>
            <p className="text-gray-600 mb-4">
              This will remove the extra security layer from your account.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter your password to confirm
              </label>
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Your password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleDisable}
              disabled={actionLoading || !disablePassword}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {actionLoading ? "Disabling..." : "Disable 2FA"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
