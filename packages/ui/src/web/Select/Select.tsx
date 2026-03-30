import React, { SelectHTMLAttributes } from 'react';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  error?: string;
}

export const Select: React.FC<SelectProps> = ({ options, error, className = '', ...props }) => {
  return (
    <div className={`${styles.container} ${className}`.trim()}>
      <div className={styles.wrapper}>
        <select className={`${styles.select} ${error ? styles.hasError : ''}`} {...props}>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className={styles.icon}>▼</div>
      </div>
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
};
