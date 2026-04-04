import React from 'react';
import styles from './SummaryCard.module.css';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { useTranslation } from 'react-i18next';


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
  const { t } = useTranslation();

  return (
    <div className={`${styles.card} ${highlighted ? styles.highlighted : ''}`}>
       <div className={styles.header}>
          <div className={styles.dateBadge}>{date}</div>
          <div className={styles.metaInfo}>
             <span className={styles.icon}>📝</span>
             <span>{wordCount} {t('summary.word_count_suffix', '字总结')}</span>
          </div>
       </div>
       <div className={styles.body}>
          <MarkdownRenderer content={markdownContent} />
       </div>
    </div>
  );
};
