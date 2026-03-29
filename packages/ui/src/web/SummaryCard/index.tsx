import React from 'react';
import styles from './SummaryCard.module.css';
import { MarkdownRenderer } from '../MarkdownRenderer';

interface SummaryCardProps {
  date: string;
  markdownContent: string;
  wordCount: number;
  highlighted?: boolean;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ 
  date, 
  markdownContent, 
  wordCount,
  highlighted = false
}) => {
  return (
    <div className={`${styles.card} ${highlighted ? styles.highlighted : ''}`}>
       <div className={styles.header}>
          <div className={styles.dateBadge}>{date}</div>
          <div className={styles.metaInfo}>
             <span className={styles.icon}>📝</span>
             <span>{wordCount} 字合成</span>
          </div>
       </div>
       <div className={styles.body}>
          <MarkdownRenderer content={markdownContent} />
       </div>
    </div>
  );
};
