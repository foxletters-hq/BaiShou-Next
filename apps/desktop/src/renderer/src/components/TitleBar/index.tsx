import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './TitleBar.module.css';
import { MdAutoStories, MdAutoAwesome, MdSettings, MdMinimize, MdCropSquare, MdClose, MdFolderShared, MdArrowDropDown } from 'react-icons/md';
import { useTranslation } from 'react-i18next';


export const TitleBar: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  // Tabs logic corresponding to Flutter tab controller
  const isAgent = location.pathname.startsWith('/agent') || location.pathname.startsWith('/c/');

  return (
    <div className={styles.titleBar}>
      <div className={styles.dragRegion}>
        <div className={styles.tabsContainer}>
          <div 
            className={`${styles.tab} ${!isAgent ? styles.activeTab : ''}`}
            onClick={() => navigate('/diary')}
          >
            <MdAutoStories className={styles.tabIcon} />
            <span>{t('nav.diary', '日记')}</span>
          </div>
          <div 
            className={`${styles.tab} ${isAgent ? styles.activeTab : ''}`}
            onClick={() => navigate('/agent')}
          >
            <MdAutoAwesome className={styles.tabIcon} />
            <span>Agent</span>
          </div>
        </div>
      </div>
      
      <div className={styles.actions}>
        <div className={styles.vaultSwitcher}>
          <MdFolderShared className={styles.actionIconSm} />
          <span className={styles.vaultName}>{t('titlebar.default_vault', '默认空间')}</span>
          <MdArrowDropDown className={styles.actionIconSm} />
        </div>

        <button className={styles.actionBtn} onClick={() => navigate('/settings')} title="Settings">
          <MdSettings className={styles.actionIcon} />
        </button>

        <div className={styles.divider}></div>

        <div className={styles.windowControls}>
          <button className={styles.winBtn} onClick={() => (window as any).api?.window?.minimize()} title={t('titlebar.minimize', '最小化')} >
            <MdMinimize />
          </button>
          <button className={styles.winBtn} onClick={() => (window as any).api?.window?.toggleMaximize()} title={t('titlebar.maximize', '最大化')} >
            <MdCropSquare />
          </button>
          <button className={`${styles.winBtn} ${styles.winCloseBtn}`} onClick={() => (window as any).api?.window?.close()} title={t('titlebar.close', '关闭')} >
            <MdClose />
          </button>
        </div>
      </div>
    </div>
  );
};
