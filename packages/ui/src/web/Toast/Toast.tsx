import React, { useEffect, useState } from 'react';
import styles from './Toast.module.css';
import { useToastState, ToastMessage } from './useToast';

const ToastItem: React.FC<{ toast: ToastMessage }> = ({ toast }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (toast.duration) {
      const timerForAnim = setTimeout(() => {
        setIsExiting(true);
      }, toast.duration - 200); // Trigger exit animation before it actually unmounts
      return () => clearTimeout(timerForAnim);
    }
    return undefined;
  }, [toast.duration]);

  const defaultIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {toast.type === 'success' && <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></>}
      {toast.type === 'error' && <><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></>}
      {toast.type === 'info' && <><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></>}
    </svg>
  );

  return (
    <div 
      className={`${styles.toast} ${isExiting ? styles.exiting : ''}`}
      style={{
        backgroundColor: toast.backgroundColor,
      }}
      onClick={() => setIsExiting(true)} 
    >
      <span className={styles.icon} style={{ color: toast.iconColor }}>
        {toast.icon || defaultIcon}
      </span>
      <span className={styles.message}>{toast.message}</span>
    </div>
  );
};

export const ToastProvider: React.FC = () => {
  const toasts = useToastState();

  if (toasts.length === 0) return null;

  return (
    <div className={styles.toastContainer}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
};
