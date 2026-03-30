"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContexts";
import { Button } from "@/components/ui/button";
import Input from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Smartphone, Key, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function Verify2FAPage() {
  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const router = useRouter();
  const { partialToken, complete2FA, twoFAMethod } = useAuth();

  useEffect(() => {
    if (!partialToken) {
      router.push("/login");
    }
  }, [partialToken, router]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API}/auth/verify-2fa`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            partial_token: partialToken,
            code: useBackupCode ? "" : code,
            backup_code: useBackupCode ? backupCode : "",
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        complete2FA(data.access_token, data.user);
        router.push("/dashboard");
      } else {
        const errorData = await res.json();
        setError(errorData.detail || "Verification failed");
      }
    } catch (error) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!partialToken) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/login")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Button>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Two-Factor Verification
            </CardTitle>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {twoFAMethod === "sms"
              ? "Enter the code sent to your phone"
              : "Enter the code from your authenticator app"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            {!useBackupCode ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Verification Code
                  </label>
                  <Input
                    type="text"
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="123456"
                    className="text-center text-lg tracking-widest"
                    maxLength={6}
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>

                <div className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    className="text-sm"
                    onClick={() => setUseBackupCode(true)}
                  >
                    Use the backup code instead
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Backup Code
                  </label>
                  <Input
                    type="text"
                    value={backupCode}
                    onChange={(e) =>
                      setBackupCode(e.target.value.toUpperCase())
                    }
                    placeholder="A1B2-C3D4"
                    className="text-center font-mono"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter one of your 8-character backup codes
                  </p>
                </div>

                <div className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    className="text-sm"
                    onClick={() => setUseBackupCode(false)}
                  >
                    Use authenticator app instead
                  </Button>
                </div>
              </>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={
                isLoading ||
                (!useBackupCode && code.length !== 6) ||
                (useBackupCode && !backupCode)
              }
              className="w-full"
            >
              {isLoading ? "Verifying..." : "Verify & Continue"}
            </Button>

            <div className="text-center text-sm text-gray-600">
              <p className="mb-2">Having Trouble?</p>
              <div className="space-x-4">
                <Link
                  href="/reset-2fa"
                  className="text-blue-600 hover:text-blue-600"
                >
                  Lost access to 2FA?
                </Link>
                <Link
                  href="/reset-2fa"
                  className="text-blue-600 hover:text-blue-600"
                >
                  Get help
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
