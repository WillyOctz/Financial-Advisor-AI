"use client";

import { atob } from "buffer";
import React, { createContext, useContext, useEffect, useState } from "react";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
  is_verified: boolean;
  is_active: boolean;
  two_factor_enabled?: boolean;
  two_factor_method?: string;
}

interface AuthContextType {
  user: User | null;
  login: (token: string, user: User, is2FA: boolean) => void;
  logout: () => void;
  isLoading: boolean;
  token: string | null;
  requiresVerification: boolean;
  requires2FA: boolean;
  setRequiresVerification: (value: boolean) => void;
  setRequires2FA: (value: boolean) => void;
  partialToken: string | null;
  setPartialToken: (token: string | null) => void;
  complete2FA: (token: string, user: User) => void;
  twoFAMethod: string | null;
  setTwoFAMethod: (method: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [partialToken, setPartialToken] = useState<string | null>(null);
  const [twoFAMethod, setTwoFAMethod] = useState<string | null>(null);
  const router = useRouter();

  // cookie configuration
  const COOKIE_OPTIONS = {
    expires: 7, // in 7 days
    path: "/",
    secure: process.env.NODE_ENV == "production",
    sameSite: "lax" as const,
  };

  useEffect(() => {
    const checkAuth = () => {
      const storedToken = localStorage.getItem("token");
      const userData = localStorage.getItem("user");
      const storedPartialToken = localStorage.getItem("partial_token");

      if (storedPartialToken) {
        setPartialToken(storedPartialToken);
        setRequires2FA(true);
        localStorage.removeItem("partial_token");
      }

      if (storedToken && userData) {
        try {
          const parsedUser = JSON.parse(userData);

          if (!parsedUser.is_verified) {
            setRequiresVerification(true);
          }

          setUser(parsedUser);
          setToken(storedToken);
        } catch (error) {
          console.error("Error parsing user data: ", error);
          clearAuthData();
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const clearAuthData = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("partial_token");
    setToken(null);
    setUser(null);
    setRequiresVerification(false);
    setRequires2FA(false);
    setPartialToken(null);
    setTwoFAMethod(null);
  };

  const login = (tokenOrPartial: string, userData: User, is2FA: boolean = false) => {
    if (is2FA) {
      // 2FA flow - storing partial token
      Cookies.set("partial_token", tokenOrPartial, COOKIE_OPTIONS);
      localStorage.setItem("partial_token", tokenOrPartial);
      localStorage.setItem("2fa_method", userData.two_factor_method || "app");

      setPartialToken(tokenOrPartial);
      setRequires2FA(true);
      setTwoFAMethod(userData.two_factor_method || "app");

      return;
    }

    // Regular login (without 2fa)
    Cookies.set("token", tokenOrPartial, COOKIE_OPTIONS);
    Cookies.set("user", JSON.stringify(userData), COOKIE_OPTIONS);
    localStorage.setItem("token", tokenOrPartial);
    localStorage.setItem("user", JSON.stringify(userData));

    setToken(tokenOrPartial);
    setUser(userData);
    setRequiresVerification(!userData.is_verified);
    setRequires2FA(false);
    setPartialToken(null);
    setTwoFAMethod(null);
  };

  const complete2FA = (fullToken: string, userData: User) => {
    Cookies.set("token", fullToken, COOKIE_OPTIONS);
    Cookies.set("user", JSON.stringify(userData), COOKIE_OPTIONS);
    Cookies.remove("partial_token");

    localStorage.setItem("token", fullToken);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.removeItem("partial_token");

    setToken(fullToken);
    setUser(userData);
    setRequires2FA(false);
    setPartialToken(null);
    setTwoFAMethod(null);

    if (!userData.is_verified) {
      setRequiresVerification(true);
    }
  };

  const logout = () => {
    clearAuthData();
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isLoading,
        token,
        requiresVerification,
        requires2FA,
        setRequiresVerification,
        setRequires2FA,
        partialToken,
        setPartialToken,
        complete2FA,
        twoFAMethod,
        setTwoFAMethod,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
