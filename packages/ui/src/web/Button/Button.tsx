import React, { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'elevated' | 'text' | 'outlined';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'elevated',
  isLoading = false,
  className = '',
  children,
  ...props
}) => {
  const baseClasses = [styles.button, styles[variant]];
  if (isLoading) baseClasses.push(styles.loading);
  if (className) baseClasses.push(className);

  return (
    <button className={baseClasses.join(' ')} disabled={isLoading || props.disabled} {...props}>
      {isLoading ? <span className={styles.spinner}></span> : null}
      {children}
    </button>
  );
};
