import React from 'react';
import styles from './AssistantMatrixCard.module.css';

export interface AssistantMatrixCardProps {
  onLaunchMatrix: () => void;
}

export const AssistantMatrixCard: React.FC<AssistantMatrixCardProps> = ({ onLaunchMatrix }) => {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
         <div className={styles.iconRing}>
            <span className={styles.icon}>🎓</span>
         </div>
         <div className={styles.info}>
           <h3 className={styles.title}>数字生命孵化工坊 (Assistant Matrix)</h3>
           <p className={styles.subtitle}>这是一个独立的庞大车间，用于孕育拥有特定职业记忆、专署 RAG 通道与工具集的多态智能分身。</p>
         </div>
      </div>
      <button className={styles.launchBtn} onClick={onLaunchMatrix}>
        进入副脑矩阵 ➔
      </button>
    </div>
  );
};
