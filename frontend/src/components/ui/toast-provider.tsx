"use client"

import { createContext, useContext, useState, ReactNode } from "react"
import { Toast, ToastProps } from "./toast"

type ToastOptions = Omit<ToastProps, "id" | "onClose"> & {
  id?: string
  duration?: number
}

type ToastItem = ToastOptions & {
  id: string
}

interface ToastContextType {
  toasts: ToastItem[]
  toast: (options: ToastOptions) => string
  dismiss: (id: string) => void
  dismissAll: () => void
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = (options: ToastOptions): string => {
    const id = options.id || Math.random().toString(36).substring(2, 9)
    
    setToasts((currentToasts) => {
      // Limit number of toasts to prevent overflow
      const newToasts = [...currentToasts, { ...options, id }]
      return newToasts.slice(-5) // Keep only last 5 toasts
    })

    // Auto dismiss if duration is set
    if (options.duration && options.duration > 0) {
      setTimeout(() => {
        dismiss(id)
      }, options.duration)
    }

    return id
  }

  const dismiss = (id: string) => {
    setToasts((currentToasts) => 
      currentToasts.filter((toast) => toast.id !== id)
    )
  }

  const dismissAll = () => {
    setToasts([])
  }

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss, dismissAll }}>
      {children}
      <div className="fixed bottom-0 right-0 z-50 flex flex-col gap-2 p-4 sm:max-w-md w-full">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            {...toast}
            onClose={() => dismiss(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}