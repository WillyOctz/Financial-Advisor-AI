"use client"

import { useContext } from "react"
import { ToastContext } from "./toast-provider"

export function useToast() {
  const context = useContext(ToastContext)
  
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }

  const { toast, dismiss, dismissAll } = context

  return {
    toast,
    dismiss,
    dismissAll,
    
    // Convenience methods
    success: (options: Omit<Parameters<typeof toast>[0], "variant">) => 
      toast({ ...options, variant: "success" }),
    
    error: (options: Omit<Parameters<typeof toast>[0], "variant">) => 
      toast({ ...options, variant: "destructive" }),
    
    warning: (options: Omit<Parameters<typeof toast>[0], "variant">) => 
      toast({ ...options, variant: "warning" }),
    
    info: (options: Omit<Parameters<typeof toast>[0], "variant">) => 
      toast({ ...options, variant: "default" }),
  }
}