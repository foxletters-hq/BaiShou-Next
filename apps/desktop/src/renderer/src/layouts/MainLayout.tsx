import React from 'react';
import { Outlet } from 'react-router-dom';
import { TitleBar } from '../components/TitleBar';
import { Sidebar } from '../components/Sidebar';
import styles from './MainLayout.module.css';

export const MainLayout: React.FC = () => {
  return (
    <div className={styles.appContainer}>
      <TitleBar />
      <div className={styles.mainContent}>
        <Sidebar />
        <div className={styles.pageContent}>
          <Outlet />
        </div>
      </div>
    </div>
  );
};
