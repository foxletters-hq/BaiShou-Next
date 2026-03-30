import { useState, useEffect, ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: ReactNode;
  duration?: number;
  icon?: ReactNode;
  backgroundColor?: string;
  iconColor?: string;
}

// Singleton state logic
let listeners: ((toasts: ToastMessage[]) => void)[] = [];
let toasts: ToastMessage[] = [];

export const toast = {
  show: (message: ReactNode, options?: Omit<ToastMessage, 'id' | 'message' | 'type'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    // Replace current toasts to mimic app_toast.dart's behavior
    const newToast: ToastMessage = { id, type: 'info', message, duration: 2000, ...options };
    toasts = [newToast];
    listeners.forEach((l) => l([...toasts]));

    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        toasts = toasts.filter((t) => t.id !== id);
        listeners.forEach((l) => l([...toasts]));
      }, newToast.duration);
    }
  },
  showSuccess: (message: ReactNode, options?: Partial<ToastMessage>) => {
    toast.show(message, { type: 'success', duration: 3000, iconColor: '#16A34A', ...options });
  },
  showError: (message: ReactNode, options?: Partial<ToastMessage>) => {
    toast.show(message, { type: 'error', duration: 5000, iconColor: '#DC2626', ...options });
  }
};

export function useToastState() {
  const [currentToasts, setCurrentToasts] = useState<ToastMessage[]>(toasts);

  useEffect(() => {
    const listener = (newToasts: ToastMessage[]) => setCurrentToasts(newToasts);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return currentToasts;
}

export function useToast() {
  return toast;
}
