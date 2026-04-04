import React from 'react';
import styles from './AssistantMatrixCard.module.css';
import { useTranslation } from 'react-i18next';


export interface AssistantMatrixCardProps {
  onLaunchMatrix: () => void;
}

export const AssistantMatrixCard: React.FC<AssistantMatrixCardProps> = ({ onLaunchMatrix }) => {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
         <div className={styles.iconRing}>
            <span className={styles.icon}>🎓</span>
         </div>
         <div className={styles.info}>
           <h3 className={styles.title}>{t('assistant.matrix_title', 'AI 助手控制台 (Assistant Matrix)')}</h3>
           <p className={styles.subtitle}>{t('assistant.matrix_desc', '用来精细化管理和创造专属助理对象，包含预设提示词配置与单独工作空间关联。')}</p>
         </div>
      </div>
      <button className={styles.launchBtn} onClick={onLaunchMatrix}>
        {t('assistant.enter_matrix', '进入控制管理')} ➔
      </button>
    </div>
  );
};
