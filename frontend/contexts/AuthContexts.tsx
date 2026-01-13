"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
  is_verified: boolean;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
  token: string | null;
  requiresVerification: boolean;
  setRequiresVerification: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [requiresVerification, setRequiresVerification] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const storedToken = localStorage.getItem("token");
      const userData = localStorage.getItem("user");

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
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = (newToken: string, userData: User) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    setRequiresVerification(!userData.is_verified);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    setRequiresVerification(false);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, token, requiresVerification, setRequiresVerification }}>
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
