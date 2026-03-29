import React from 'react';
import styles from './MissingSummaryCard.module.css';

interface MissingSummaryCardProps {
  dateStr: string;
  onGenerate: () => void;
  onSkip?: () => void;
}

export const MissingSummaryCard: React.FC<MissingSummaryCardProps> = ({ 
  dateStr, 
  onGenerate,
  onSkip 
}) => {
  return (
    <div className={styles.card}>
      <div className={styles.iconBox}>
         ⚠️
      </div>
      <div className={styles.content}>
         <h4>{dateStr} 记录缺失</h4>
         <p>你今天似乎还没有让 AI 总结过日记记录，现在要一键生成吗？</p>
         <div className={styles.actions}>
            <button className={styles.generateBtn} onClick={onGenerate}>
               ✨ 立即生成总结
            </button>
            {onSkip && (
               <button className={styles.skipBtn} onClick={onSkip}>
                  忽 略
               </button>
            )}
         </div>
      </div>
    </div>
  );
};
