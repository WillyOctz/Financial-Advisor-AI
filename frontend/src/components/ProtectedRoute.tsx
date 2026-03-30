"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContexts";

export default function ProtectedRoute({
  children,
  requireEmailVerification = true,
}: {
  children: React.ReactNode;
  requireEmailVerification?: boolean;
}) {
  const { user, isLoading, requiresVerification, requires2FA, partialToken } =
    useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      // check 2fa first
      if (partialToken && requires2FA) {
        router.push("/verify-2fa");
        return;
      }

      // check authentication
      if (!user) {
        router.push("/login");
        return;
      }

      // check email verification
      if (requiresVerification && requireEmailVerification) {
        router.push("/verify-email");
        return;
      }
    }
  }, [user, isLoading, router, requiresVerification, requireEmailVerification, requires2FA, partialToken]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (partialToken && requires2FA) {
    return null;
  }

  return user && !requiresVerification ? <>{children}</> : null;
}
