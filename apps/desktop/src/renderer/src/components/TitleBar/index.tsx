import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './TitleBar.module.css';
import { MdAutoStories, MdAutoAwesome, MdMinimize, MdCropSquare, MdClose, MdFolderShared, MdArrowDropDown } from 'react-icons/md';
import { useTranslation } from 'react-i18next';

export const TitleBar: React.FC = () => {
  const { t } = useTranslation();

  const location = useLocation();
  const navigate = useNavigate();

  const [vaults, setVaults] = useState<any[]>([]);
  const [activeVault, setActiveVault] = useState<any>(null);
  const [showVaultMenu, setShowVaultMenu] = useState(false);
  const vaultMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchVaults = async () => {
      try {
        const vList = await (window as any).api?.vault?.vaultGetAll();
        const active = await (window as any).api?.vault?.vaultGetActive();
        if (vList) setVaults(vList);
        if (active) setActiveVault(active);
      } catch (e) {}
    };
    fetchVaults();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (vaultMenuRef.current && !vaultMenuRef.current.contains(e.target as Node)) {
        setShowVaultMenu(false);
      }
    };
    if (showVaultMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showVaultMenu]);

  const handleSwitchVault = async (vaultName: string) => {
    try {
      await (window as any).api?.vault?.vaultSwitch(vaultName);
      const active = await (window as any).api?.vault?.vaultGetActive();
      if (active) setActiveVault(active);
      setShowVaultMenu(false);
    } catch (e) {
      console.error(e);
    }
  };

  // Tabs logic corresponding to Flutter tab controller
  const isAgent = location.pathname.startsWith('/agent') || location.pathname.startsWith('/c/');

  return (
    <div className={styles.titleBar}>
      <div className={styles.dragRegion}>
        <div className={styles.tabsContainer}>
          <div 
            className={`${styles.tab} ${!isAgent ? styles.activeTab : ''}`}
            onClick={() => {
              try {
                const saved = localStorage.getItem('desktop_sidebar_nav_order');
                if (saved) {
                   const parsed = JSON.parse(saved);
                   if (Array.isArray(parsed) && parsed.length > 0) {
                      const paths: Record<string, string> = { diary: '/diary', summary: '/summary', lan: '/settings/lan-transfer', sync: '/settings/data-sync' };
                      if (paths[parsed[0]]) {
                         navigate(paths[parsed[0]]);
                         return;
                      }
                   }
                }
              } catch (e) {}
              navigate('/diary');
            }}
          >
            <MdAutoStories className={styles.tabIcon} />
            <span>{t('nav.diary', '日记')}</span>
          </div>
          <div 
            className={`${styles.tab} ${isAgent ? styles.activeTab : ''}`}
            onClick={() => navigate('/agent')}
          >
            <MdAutoAwesome className={styles.tabIcon} />
            <span>{t('nav.agent', '伙伴')}</span>
          </div>
        </div>
      </div>
      
      <div className={styles.actions}>
        <div className={styles.vaultSwitcherWrapper} ref={vaultMenuRef} style={{ position: 'relative' }}>
          <div className={styles.vaultSwitcher} onClick={() => setShowVaultMenu(!showVaultMenu)}>
            <MdFolderShared className={styles.actionIconSm} />
            <span className={styles.vaultName}>{activeVault?.name || t('titlebar.default_vault', '默认空间')}</span>
            <MdArrowDropDown className={styles.actionIconSm} />
          </div>
          {showVaultMenu && vaults.length > 0 && (
            <div className={styles.vaultMenu} style={{
              position: 'absolute', top: '100%', right: 0, marginTop: '4px',
              background: 'var(--color-surface, #fff)', border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 1000,
              minWidth: '150px', padding: '4px'
            }}>
              {vaults.map((v, i) => (
                <div key={i} onClick={() => handleSwitchVault(v.name)} style={{
                  padding: '8px 12px', cursor: 'pointer', borderRadius: '4px',
                  display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px',
                  color: v.name === activeVault?.name ? 'var(--color-primary)' : 'inherit',
                  background: v.name === activeVault?.name ? 'rgba(91,168,245,0.08)' : 'transparent'
                }}>
                  {v.name}
                </div>
              ))}
            </div>
          )}
        </div>

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
