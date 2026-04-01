import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './TitleBar.module.css';
import { Search } from 'lucide-react';

export const TitleBar: React.FC = () => {
  const location = useLocation();
  const [showPalette, setShowPalette] = useState(false);

  // 简单的面包屑逻辑
  const getBreadcrumbs = () => {
    const path = location.pathname;
    if (path === '/') return '白守大厅 / Hub';
    if (path.startsWith('/chat/')) return '白守大厅 / 智脑会话';
    if (path.startsWith('/assistants')) return '配置舱 / Agent 流库';
    if (path.startsWith('/settings')) return '偏好栈 / Settings';
    if (path.startsWith('/diary')) return '时光轴 / 日记';
    if (path.startsWith('/storage')) return '存储库 / Vault';
    return ' BaiShou AI';
  };

  return (
    <div className={styles.titleBar}>
      <div className={styles.dragRegion}>
         {/* 面包屑显示 */}
         <div className={styles.breadcrumb}>
            <span className={styles.breadcrumbBadge}>v1.5</span>
            <span className={styles.breadcrumbText}>{getBreadcrumbs()}</span>
         </div>
         
         {/* 模拟的全局搜索框占位（Cmd+K） */}
         <div className={styles.globalSearchBox} onClick={() => setShowPalette(true)}>
            <Search size={12} className={styles.searchIcon} />
            <span className={styles.searchPlaceholder}>在全局搜索或下达指令...</span>
            <span className={styles.searchShortcut}>⌘K</span>
         </div>
      </div>
      <div className={styles.actions}>
         <button className={styles.themeToggle} title="切换主题">
            🌗
         </button>
         <div className={styles.windowControls}>
            <button className={styles.winBtn} onClick={() => (window as any).api?.window?.minimize()} title="最小化" >
              <svg width="10" height="10" viewBox="0 0 10 10"><path d="M 0,5 10,5" stroke="currentColor" strokeWidth="1.5"/></svg>
            </button>
            <button className={styles.winBtn} onClick={() => (window as any).api?.window?.toggleMaximize()} title="最大化" >
              <svg width="10" height="10" viewBox="0 0 10 10"><path d="M 1,1 9,1 9,9 1,9 Z" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>
            </button>
            <button className={`${styles.winBtn} ${styles.winCloseBtn}`} onClick={() => (window as any).api?.window?.close()} title="关闭" >
              <svg width="10" height="10" viewBox="0 0 10 10"><path d="M 1,1 9,9 M 1,9 9,1" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>
            </button>
         </div>
      </div>
    </div>
  );
};
