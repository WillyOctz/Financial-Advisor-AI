"use client"

import { ReactNode } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ToastProps {
  id?: string
  title?: ReactNode
  description?: ReactNode
  variant?: "default" | "destructive" | "success" | "warning"
  action?: ReactNode
  onClose?: () => void
  className?: string
}

const variantClasses = {
  default: "bg-background border",
  destructive: "bg-destructive text-destructive-foreground",
  success: "bg-green-500 text-white",
  warning: "bg-yellow-500 text-white",
}

export function Toast({
  title,
  description,
  variant = "default",
  action,
  onClose,
  className,
}: ToastProps) {
  return (
    <div
      className={cn(
        "relative w-full flex items-center justify-between p-4 rounded-lg shadow-lg border",
        "animate-in slide-in-from-right-full data-[swipe=end]:animate-out data-[swipe=end]:fade-out-80",
        "data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) data-[swipe=cancel]:translate-x-0",
        "data-[swipe=end]:translate-x-(--radix-toast-swipe-end-x) transition-transform",
        variantClasses[variant],
        className
      )}
      role="alert"
    >
      <div className="flex-1">
        {title && (
          <div className={cn(
            "font-semibold",
            variant === "destructive" || variant === "success" || variant === "warning" 
              ? "text-white" 
              : "text-foreground"
          )}>
            {title}
          </div>
        )}
        {description && (
          <div className={cn(
            "text-sm mt-1",
            variant === "destructive" || variant === "success" || variant === "warning"
              ? "text-white/90"
              : "text-muted-foreground"
          )}>
            {description}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {action}
        {onClose && (
          <button
            onClick={onClose}
            className={cn(
              "rounded-md p-1 transition-opacity hover:opacity-70 focus:outline-none focus:ring-2",
              variant === "destructive" || variant === "success" || variant === "warning"
                ? "text-white hover:bg-white/20"
                : "text-foreground hover:bg-accent"
            )}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}