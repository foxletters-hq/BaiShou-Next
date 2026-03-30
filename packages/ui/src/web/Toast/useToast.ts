import { useState, useEffect, ReactNode } from 'react';

export interface ToastMessage {
  id: string;
  content: ReactNode;
  duration?: number;
}

let listeners: ((toasts: ToastMessage[]) => void)[] = [];
let toasts: ToastMessage[] = [];

export const toast = (content: ReactNode, duration = 3000) => {
  const id = Math.random().toString(36).substring(2, 9);
  const newToast = { id, content, duration };
  toasts = [...toasts, newToast];
  listeners.forEach((l) => l([...toasts]));

  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    listeners.forEach((l) => l([...toasts]));
  }, duration);
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
  return { toast };
}
