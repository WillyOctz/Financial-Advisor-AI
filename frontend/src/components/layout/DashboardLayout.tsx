"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import {
  LogOut,
  User,
  Settings,
  TrendingUp,
  BarChart3,
  Upload,
  Home,
  MessageSquare,
  Calendar,
  Menu,
  X,
  DollarSign,
} from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Track scrolling for header styling
  useEffect(() => {
    setMounted(true);

    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  const handleSettings = () => {
    window.location.href = "/settings";
  };

  const navigation = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: Home,
      description: "Home Dashboard",
    },
    {
      name: "Upload",
      href: "/dashboard/upload",
      icon: Upload,
      description: "Import transactions",
    },
    {
      name: "Analysis",
      href: "/dashboard/analysis",
      icon: BarChart3,
      description: "Spending Pattern Analysis",
    },
    {
      name: "Advice",
      href: "/dashboard/chats",
      icon: MessageSquare,
      description: "AI Advice For Better Planning",
    },
    {
      name: "Forecast",
      href: "/dashboard/forecast",
      icon: TrendingUp,
      description: "Future predictions",
    },
    {
      name: "History",
      href: "/dashboard/transactions",
      icon: Calendar,
      description: "See Past Transactions History",
    },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-300 via-blue-200 to-slate-50">
      {/* Premium header with glass effect */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? "bg-white/80 backdrop-blur-xl shadow-lg border-b border-slate-200/50"
            : "bg-transparent"
        } ${mounted ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo Section */}
            <Link
              href="/dashboard"
              className="flex items-center space-x-3 group"
            >
              {/* Animated Logo */}
              <div className="relative">
                <div className="absolute inset-0 bg-linear-to-br from-amber-400 to-orange-500 rounded-2xl blur-md opacity-50 group-hover:opacity-75 transition-opacity"></div>
                <div className="relative bg-linear-to-br from-amber-400 to-orange-500 p-2.5 rounded-2xl transform group-hover:scale-110 transition-transform duration-300">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
              </div>

              <div>
                <span className="font-bold text-xl text-slate-900 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-linear-to-r group-hover:from-amber-600 group-hover:to-orange-600 transition-all">
                  Financial AI
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group relative px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                      isActive
                        ? "text-slate-900"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <span className="absolute inset-0 bg-linear-to-br from-amber-100 to-orange-100 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-300"></span>
                    )}

                    {/* Hover effect */}
                    <span className="absolute inset-0 bg-slate-100 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>

                    {/* Content */}
                    <span className="relative flex items-center gap-2">
                      <item.icon className="w-4 h-4" />
                      {item.name}
                    </span>

                    {/* Tooltip on hover */}
                    <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300 whitespace-nowrap">
                      {item.description}
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-900"></span>
                    </span>
                  </Link>
                );
              })}
            </nav>

            {/* Right Section */}
            <div className="flex items-center gap-3">
              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative rounded-full hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      {/* Avatar */}
                      <div className="relative">
                        <div className="absolute inset-0 bg-linear-to-br from-blue-400 to-cyan-400 rounded-full blur-sm opacity-50"></div>
                        <div className="relative w-10 h-10 bg-linear-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center transform hover:scale-110 transition-transform duration-300">
                          <User className="h-5 w-5 text-white" />
                        </div>
                      </div>

                      {/* Username - hidden on when on mobile */}
                      <div className="hidden md:block text-left">
                        <span className="text-sm font-semibold text-slate-900 block">
                          {user?.first_name}
                        </span>
                        <span className="text-xs text-slate-500">
                          {user?.email?.split("@")[0]}
                        </span>
                      </div>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-64 p-2 bg-white/95 backdrop-blue-xl border border-slate-200 shadow-2xl"
                  align="end"
                  forceMount
                >
                  {/* User info header */}
                  <div className="px-3 py-3 bg-linear-to-br from-slate-50 to-blue-50 rounded-lg mb-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {user?.first_name} {user?.last_name}
                    </p>
                    <p className="text-xs text-slate-600 truncate">
                      {user?.email}
                    </p>
                  </div>

                  <DropdownMenuSeparator />

                  {/* Menu Items */}
                  <DropdownMenuItem
                    onClick={handleSettings}
                    className="cursor-pointer rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <Settings className="mr-3 h-4 w-4 text-slate-600" />
                    <span className="text-slate-700">Settings</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer rounded-lg hover:bg-red-50 transition-colors text-red-600"
                  >
                    <LogOut className="mr-3 h-4 w-4" />
                    <span className="font-medium">Log Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-slate-200 shadow-xl animate-in slide-in-from-top-5 duration-300">
            <nav className="max-w-7xl mx-auto px-4 py-4 space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                      isActive
                        ? "bg-linear-to-br from-amber-100 to-orange-100 text-slate-900 shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-slate-500">
                        {item.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Main content area */}
      <main className="pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Content with fade-in animation */}
          <div
            className={`transition-all duration-700 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white/50 backdrop-blur-sm border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-600">
              © 2025 Financial AI. Powered by Sigma Corps.
            </p>
            <div className="flex items-center gap-6 text-sm text-slate-600">
              <a
                href="#"
                className="hover:text-slate-900 transition-colors"
              >
                Contact
              </a>
              <a
                href="#"
                className="hover:text-slate-900 transition-colors"
              >
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
