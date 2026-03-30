import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './OnboardingScreen.module.css';

export const OnboardingScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.screen}>
      <div className={styles.contentBox}>
        <div className={styles.logoWrapper}>
          <div className={styles.logo}>✨</div>
        </div>
        <h1 className={styles.title}>欢迎来到 BaiShou Next</h1>
        <p className={styles.subtitle}>强大的 Agent 网络系统，为你提供智能且高效的自动化协同体验。</p>
        
        <button 
          className={styles.startBtn}
          onClick={() => navigate('/')}
        >
          开始探索
        </button>
      </div>
    </div>
  );
};
