import React, { HTMLAttributes } from 'react';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ hoverable = false, className = '', children, ...props }) => {
  return (
    <div className={`${styles.card} ${hoverable ? styles.hoverable : ''} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
