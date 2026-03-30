import React, { HTMLAttributes } from 'react';
import styles from './Badge.module.css';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'dot' | 'capsule';
  count?: number;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'capsule', count, className = '', ...props }) => {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${className}`.trim()} {...props}>
      {variant === 'capsule' && count !== undefined ? (count > 99 ? '99+' : count) : null}
    </span>
  );
};
