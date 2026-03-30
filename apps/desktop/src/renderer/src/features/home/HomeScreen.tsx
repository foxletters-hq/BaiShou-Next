import React from 'react';
import styles from './HomeScreen.module.css';

export const HomeScreen: React.FC = () => {
  return (
    <div className={styles.screen}>
       <div className={styles.logoWrapper}>
          <div className={styles.logo}>✨</div>
       </div>
       <h1 className={styles.title}>欢迎使用 BaiShou AI</h1>
       <p className={styles.subtitle}>请在左侧选择或新建一个对话</p>
    </div>
  );
};
