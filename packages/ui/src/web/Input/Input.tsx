import React, { InputHTMLAttributes } from 'react';
import styles from './Input.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className={`${styles.container} ${className}`.trim()}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.inputWrapper}>
        <input 
          className={`${styles.input} ${error ? styles.hasError : ''}`}
          {...props} 
        />
      </div>
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
};
