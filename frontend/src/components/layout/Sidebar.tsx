"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Upload,
  BarChart3,
  TrendingUp,
  MessageSquare,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SideBarprops {
  className?: string;
}

export function Sidebar({ className }: SideBarprops) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const navigation = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: Home,
      badge: null,
      color: "blue",
    },
    {
      name: "Upload",
      href: "/dashboard/upload",
      icon: Upload,
      badge: null,
      color: "emerald",
    },
    {
      name: "Analysis",
      href: "/dashboard/analysis",
      icon: BarChart3,
      badge: null,
      color: "purple",
    },
    {
      name: "AI Advice",
      href: "/dashboard/chats",
      icon: MessageSquare,
      badge: "New",
      color: "amber",
    },
    {
      name: "Forecast",
      href: "/dashboard/forecast",
      icon: TrendingUp,
      badge: null,
      color: "rose",
    },
    {
      name: "History",
      href: "/dashboard/transactions",
      icon: Calendar,
      badge: null,
      color: "cyan",
    },
  ];

  const colorClasses = {
    blue: "bg-blue-100 text-blue-700 group-hover:bg-blue-200",
    emerald: "bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200",
    purple: "bg-purple-100 text-purple-700 group-hover:bg-purple-200",
    amber: "bg-amber-100 text-amber-700 group-hover:bg-amber-200",
    rose: "bg-rose-100 text-rose-700 group-hover:bg-rose-200",
    cyan: "bg-cyan-100 text-cyan-700 group-hover:bg-cyan-200",
  };

  return (
    <aside
      className={cn(
        "bg-white border-r border-slate-200 transition-all duration-300 ease-in-out flex flex-col shadow-lg",
        collapsed ? "w-20" : "w-72",
        className,
      )}
    >
      {/* Header Section */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-3 overflow-hidden">
              {/* Logo */}
              <div className="relative shrink-0">
                <div className="absolute inset-0 bg-linear-to-br from-amber-400 to-orange-500 rounded-xl blur-md opacity-50"></div>
                <div className="relative bg-linear-to-br from-amber-400 to-orange-500 p-2 rounded-xl">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
              </div>

              {/* Title */}
              <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                <h2 className="font-bold text-lg text-slate-900">
                  Financial AI
                </h2>
              </div>
            </div>
          )}

          {/* Toggle Button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "p-2 rounded-lg hover:bg-slate-100 transition-all duration-300 group",
              collapsed && "mx-auto",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-900 transition-colors" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-slate-600 group-hover:text-slate-900 transition-colors" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation Section */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navigation.map((item, index) => {
          const isActive = pathname === item.href;
          const colorClass =
            colorClasses[item.color as keyof typeof colorClasses];

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                isActive
                  ? "bg-linear-to-r from-slate-900 to-slate-800 text-white shadow-lg scale-105"
                  : "text-slate-600 hover:bg-slate-50 hover:scale-102",
              )}
              style={{ transitionDelay: `${index * 30}ms` }}
            >
              {/* Active Indicator Glow */}
              {isActive && (
                <div className="absolute inset-0 bg-slate-900 blur-xl opacity-20 rounded-xl"></div>
              )}

              {/* Icon with Color Background */}
              <div
                className={cn(
                  "relative shrink-0 p-2 rounded-lg transition-all duration-300",
                  isActive ? "bg-white/20 text-white" : colorClass,
                )}
              >
                <item.icon className="w-5 h-5" />
              </div>

              {/* Label */}
              {!collapsed && (
                <div className="flex-1 overflow-hidden">
                  <span
                    className={cn(
                      "text-sm font-medium block truncate animate-in fade-in slide-in-from-left-2 duration-300",
                      isActive
                        ? "text-white"
                        : "text-slate-700 group-hover:text-slate-900",
                    )}
                  >
                    {item.name}
                  </span>
                </div>
              )}

              {/* Badge */}
              {!collapsed && item.badge && (
                <span className="shrink-0 px-2 py-0.5 text-xs font-medium bg-amber-400 text-amber-900 rounded-full animate-in fade-in zoom-in duration-300">
                  {item.badge}
                </span>
              )}

              {/* Tooltip for collapsed state */}
              {collapsed && (
                <div className="absolute left-full ml-3 px-3 py-2 bg-slate-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300 whitespace-nowrap z-50">
                  {item.name}
                  {item.badge && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-amber-400 text-amber-900 rounded-full">
                      {item.badge}
                    </span>
                  )}
                  {/* Arrow */}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900"></div>
                </div>
              )}

              {/* Hover Effect */}
              {!isActive && (
                <div className="absolute inset-0 bg-linear-to-r from-slate-100 to-transparent opacity-0 group-hover:opacity-100 rounded-xl transition-opacity duration-300"></div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Section */}
      <div className="p-4 border-t border-slate-200">
        {!collapsed ? (
          <div className="bg-linear-to-br from-blue-50 to-cyan-50 p-4 rounded-xl border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h3>Pro Tip</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Upload Transactions regularly
            </p>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
