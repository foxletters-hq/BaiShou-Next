import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import styles from './MainLayout.module.css';
import { motion } from 'framer-motion';

export const MainLayout: React.FC = () => {
  const location = useLocation();
  const isAgent = location.pathname.startsWith('/agent') || location.pathname.startsWith('/chat');

  return (
    <div className={styles.appContainer}>
      <div className={styles.mainContent}>
        <Sidebar />
        <div className={styles.pageContent} style={{ position: 'relative' }}>
          <Outlet />
          
          {/* 原版白守渐变过渡：切换任意底座根路由时展示一个瞬发并淡出的背景遮罩层以统一视效 */}
          <motion.div
            key={location.pathname.split('/')[1] || 'home'}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'var(--bg-surface)',
              pointerEvents: 'none',
              zIndex: 50
            }}
          />
        </div>
      </div>
    </div>
  );
};
