import React from 'react';
import styles from './ToolCallSkeleton.module.css';

interface ToolCallSkeletonProps {
  toolName: string;
}

export const ToolCallSkeleton: React.FC<ToolCallSkeletonProps> = ({ toolName }) => {
  return (
    <div className={styles.container}>
      <div className={styles.iconPulse}>
        <div className={styles.spinner} />
      </div>
      <div className={styles.content}>
        <span className={styles.label}>AI Agent 正在使用工具</span>
        <span className={styles.toolName}>{toolName}</span>
      </div>
    </div>
  );
};
