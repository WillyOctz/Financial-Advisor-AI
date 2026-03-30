"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "../../../contexts/AuthContexts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Settings, DollarSignIcon } from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  const handleSettings = () => {
    window.location.href = "/settings"
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Navigation */}
            <div className="flex items-center space-x-8">
              <Link href="/dashboard" className="flex items-center space-x-2">
                <div>
                  <DollarSignIcon className="w-8 h-8 bg-amber-200 rounded-xl"/>
                </div>
                <span className="font-bold text-xl text-gray-900">
                  AI Financial Advisor
                </span>
              </Link>

              <nav className="hidden md:flex space-x-6">
                <Link
                  href="/dashboard"
                  className="text-gray-700 hover:text-blue-600 font-medium"
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/upload"
                  className="text-gray-700 hover:text-blue-600 font-medium"
                >
                  Upload
                </Link>
                <Link
                  href="/dashboard/analysis"
                  className="text-gray-700 hover:text-blue-600 font-medium"
                >
                  Analysis
                </Link>
                <Link
                  href="/dashboard/chats"
                  className="text-gray-700 hover:text-blue-600 font-medium"
                >
                  AI Advice
                </Link>
                <Link
                  href="/dashboard/forecast"
                  className="text-gray-700 hover:text-blue-600 font-medium"
                >
                  Forecast
                </Link>
                <Link
                  href="/dashboard/transactions"
                  className="text-gray-700 hover:text-blue-600 font-medium"
                >
                  Transaction History
                </Link>
              </nav>
            </div>

            {/* User Menu */}
            <div className="flex items-center justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="px-3 rounded-full flex items-center justify-center"
                  >
                    <div className="flex items-center space-x-2 justify-center">
                      <User className="h-5 w-5" />
                      <span className="hidden md:block text-sm font-medium">
                        {user?.first_name}
                      </span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user?.first_name} {user?.last_name}
                      </p>
                      <p className="text-xs leading-none text-gray-600">
                        {user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSettings}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
