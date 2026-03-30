import React from 'react';
import styles from './TitleBar.module.css';

export const TitleBar: React.FC = () => {
  return (
    <div className={styles.titleBar}>
      {/* Mac Traffic Lights placeholder (managed by OS on Mac, but we pad left if needed) */}
      <div className={styles.dragRegion}>
         <span className={styles.title}>BaiShou AI</span>
      </div>
      
      {/* Windows control placeholders (electron handles them natively or we custom build)
          Usually electron handles them if we set titleBarStyle: 'hidden' or 'hiddenInset' in main process
      */}
      <div className={styles.actions}>
         <button className={styles.themeToggle} title="切换主题">
            🌗
         </button>
      </div>
    </div>
  );
};
