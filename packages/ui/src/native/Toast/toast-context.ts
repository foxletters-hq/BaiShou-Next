import { createContext, useContext } from 'react'

export type ToastType = 'info' | 'success' | 'error' | 'warning'

export interface ToastShowOptions {
  duration?: number
  onDismiss?: () => void
}

export interface ToastContextType {
  showToast: (message: string, type?: ToastType, options?: ToastShowOptions) => void
  showSuccess: (message: string, options?: ToastShowOptions) => void
  showError: (message: string, options?: ToastShowOptions) => void
  showInfo: (message: string, options?: ToastShowOptions) => void
  showWarning: (message: string, options?: ToastShowOptions) => void
}

/** 独立模块持有 Context，避免 Metro barrel 重复加载导致 Provider/Hook 不一致 */
export const ToastContext = createContext<ToastContextType | null>(null)

export const useNativeToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useNativeToast must be used within ToastProvider')
  return ctx
}
