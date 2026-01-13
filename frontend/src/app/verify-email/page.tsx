"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Input from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Mail,
  RefreshCcw,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [verificationMethod, setVerificationMethod] = useState<
    "token" | "email"
  >(token ? "token" : "email");

  useEffect(() => {
    if (token) {
      verifyToken(token);
    }
  }, [token]);

  const verifyToken = async (verificationToken: string) => {
    setStatus("loading");
    try {
      const response = await apiClient.post("/auth/verify-email", {
        token: verificationToken,
      });

      setStatus("success");
      setMessage(response.data.message);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/login?verified=true");
      }, 3000);
    } catch (error: any) {
      setStatus("error");
      setMessage(error.response?.data?.detail || "Verification failed");
    }
  };

  const handleEmailVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    try {
      const res = await apiClient.post("/auth/resend-verification", {
        email: email,
      });

      setStatus("success");
      setMessage(res.data.message);
    } catch (error: any) {
      setStatus("error");
      setMessage(
        error.response?.data?.detail || "Failed to resend verification"
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 to-indigo-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            {status === "success" ? (
              <CheckCircle className="h-8 w-8 text-green-600" />
            ) : (
              <Mail className="h-8 w-8 text-blue-600" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {verificationMethod === "token"
              ? "Email Verification"
              : "Resend Verification"}
          </CardTitle>
          <p className="text-gray-600 mt-2">
            {verificationMethod === "token"
              ? "Please wait while we verify your email address"
              : "Enter your email to receive a new verification link"}
          </p>
        </CardHeader>

        <CardContent>
          {verificationMethod === "token" ? (
            <div className="space-y-4">
              <div className="text-center">
                {status === "loading" && (
                  <div className="space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-700">Verifying your email...</p>
                  </div>
                )}

                {status === "success" && (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-green-800 font-medium">{message}</p>
                      <p className="text-sm text-green-600 mt-2">
                        Redirecting to login page...
                      </p>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => router.push("/login")}
                    >
                      Go to Login <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}

                {status === "error" && (
                  <div className="space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        <p className="text-red-800 font-medium">{message}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="text-gray-600 text-sm">
                        Need a new verification link?
                      </p>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setVerificationMethod("email")}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Resend Verfication Email
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleEmailVerification} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                  Email Address
                </label>
                <div className="items-center flex justify-center">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    disabled={status === "loading"}
                  />
                </div>
              </div>

              {status === "success" && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800">{message}</p>
                  <p className="text-sm text-green-600 mt-1">
                    Please check your inbox and spam folder.
                  </p>
                </div>
              )}

              {status === "error" && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800">{message}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={status === "loading" || !email}
              >
                {status === "loading" ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 w-4 h-4" />
                    Send Verification Email
                  </>
                )}
              </Button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Already verified? Go to Login
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
