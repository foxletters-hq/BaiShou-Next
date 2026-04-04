import { useTranslation } from 'react-i18next';
import React from 'react';
import styles from './ToolCallSkeleton.module.css';

interface ToolCallSkeletonProps {
  toolName: string;
}

export const ToolCallSkeleton: React.FC<ToolCallSkeletonProps> = ({ toolName }) => {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      <div className={styles.iconPulse}>
        <div className={styles.spinner} />
      </div>
      <div className={styles.content}>
        <span className={styles.label}>{t('agent.chat.using_tool', 'AI 核心协议激活并流转中')}</span>
        <span className={styles.toolName}>{toolName}</span>
      </div>
    </div>
  );
};
