import React, { HTMLAttributes, useState } from 'react';
import styles from './Tooltip.module.css';

export interface TooltipProps extends Omit<HTMLAttributes<HTMLDivElement>, 'content'> {
  content: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, className = '', ...props }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className={`${styles.container} ${className}`.trim()} 
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      {...props}
    >
      {children}
      {isVisible && (
        <div className={styles.tooltip}>
          {content}
        </div>
      )}
    </div>
  );
};
