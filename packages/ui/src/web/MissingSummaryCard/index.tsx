import React from 'react';
import styles from './MissingSummaryCard.module.css';
import { useTranslation } from 'react-i18next';


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
  const { t } = useTranslation();

  return (
    <div className={styles.card}>
      <div className={styles.iconBox}>
         ⚠️
      </div>
      <div className={styles.content}>
         <h4>{dateStr} {t('summary.missing_title', '总结缺失')}</h4>
         <p>{t('summary.missing_desc', '在这段时间内还未生成过总结，现在是否需要一键补全？')}</p>
         <div className={styles.actions}>
            <button className={styles.generateBtn} onClick={onGenerate}>
               ✨ {t('summary.generate_now', '立即生成日记总结')}
            </button>
            {onSkip && (
               <button className={styles.skipBtn} onClick={onSkip}>
                  {t('common.ignore', '忽略')}
               </button>
            )}
         </div>
      </div>
    </div>
  );
};
