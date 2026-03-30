import React from 'react';
import styles from './Toast.module.css';
import { useToastState } from './useToast';

export const ToastProvider: React.FC = () => {
  const toasts = useToastState();

  if (toasts.length === 0) return null;

  return (
    <div className={styles.toastContainer}>
      {toasts.map((t) => (
        <div key={t.id} className={styles.toast}>
          {t.content}
        </div>
      ))}
    </div>
  );
};
