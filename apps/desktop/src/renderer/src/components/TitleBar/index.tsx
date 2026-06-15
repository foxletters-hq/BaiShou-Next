import React, { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import styles from './TitleBar.module.css'
import {
  MdAutoStories,
  MdAutoAwesome,
  MdMinimize,
  MdCropSquare,
  MdClose,
  MdFolderShared,
  MdArrowDropDown,
  MdSettings
} from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { isIncrementalSyncReady } from '@baishou/shared'
import { IncrementalSyncPanel, WorkspaceScopeHelpTooltip } from '@baishou/ui'

import { resolveDiaryHomePath } from '../Sidebar/sidebar-preferences'
import { useOrchestratedSync } from '../../hooks/useOrchestratedSync'

export const TitleBar: React.FC = () => {
  const { t } = useTranslation()

  const location = useLocation()
  const navigate = useNavigate()

  const [vaults, setVaults] = useState<any[]>([])
  const [activeVault, setActiveVault] = useState<any>(null)
  const [showVaultMenu, setShowVaultMenu] = useState(false)
  const [isSwitchingVault, setIsSwitchingVault] = useState(false)
  const vaultMenuRef = useRef<HTMLDivElement>(null)
  const preloadedVaultsRef = useRef<Set<string>>(new Set())
  const [s3Configured, setS3Configured] = useState(false)
  const { isSyncing, progress, startSync } = useOrchestratedSync()

  useEffect(() => {
    let timeoutId: any
    let retries = 0
    const fetchVaults = async () => {
      try {
        const vList = await (window as any).api?.vault?.list()
        const active = await (window as any).api?.vault?.getActive()
        if (vList) setVaults(vList)
        if (active) setActiveVault(active)

        if ((!vList || vList.length === 0) && retries < 10) {
          retries++
          timeoutId = setTimeout(fetchVaults, 500)
        }
      } catch (e) {}
    }
    fetchVaults()
    return () => clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (vaultMenuRef.current && !vaultMenuRef.current.contains(e.target as Node)) {
        setShowVaultMenu(false)
      }
    }
    if (showVaultMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showVaultMenu])

  useEffect(() => {
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let retries = 0
    const fetchConfig = async () => {
      try {
        const cfg = await (window as any).api?.incrementalSync?.getConfig?.()
        if (!cancelled) setS3Configured(isIncrementalSyncReady(cfg))
      } catch {
        if (!cancelled && retries < 5) {
          retries++
          retryTimer = setTimeout(fetchConfig, 1000)
        }
      }
    }
    fetchConfig()
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [])

  const preloadVault = (vaultName: string) => {
    if (!vaultName || vaultName === activeVault?.name) return
    if (preloadedVaultsRef.current.has(vaultName)) return
    preloadedVaultsRef.current.add(vaultName)
    void (window as any).api?.vault?.preload?.(vaultName)?.catch?.(() => {
      preloadedVaultsRef.current.delete(vaultName)
    })
  }

  const handleSwitchVault = async (vaultName: string) => {
    if (isSwitchingVault || vaultName === activeVault?.name) return
    setIsSwitchingVault(true)
    try {
      await (window as any).api?.vault?.switchActive(vaultName)
      await (window as any).api?.vault?.waitForResync?.()
      setShowVaultMenu(false)
      window.location.reload()
    } catch (e) {
      console.error(e)
      setIsSwitchingVault(false)
    }
  }

  // Tabs logic corresponding to Flutter tab controller
  const isAgent = location.pathname.startsWith('/agent') || location.pathname.startsWith('/chat')
  const isSettings = location.pathname.startsWith('/settings')
  const isOnboarding = location.pathname.startsWith('/welcome')

  return (
    <div className={`${styles.titleBar} ${isOnboarding ? styles.titleBarOnboarding : ''}`}>
      <div className={styles.dragRegion}>
        {!isOnboarding && (
          <div className={styles.tabsContainer}>
            <div
              className={`${styles.tab} ${!isAgent && !isSettings ? styles.activeTab : ''}`}
              onClick={() => navigate(resolveDiaryHomePath())}
            >
              <MdAutoStories className={styles.tabIcon} />
              <span>{t('nav.diary', '日记')}</span>
            </div>
            <div
              className={`${styles.tab} ${isAgent && !isSettings ? styles.activeTab : ''}`}
              onClick={() => navigate('/chat')}
            >
              <MdAutoAwesome className={styles.tabIcon} />
              <span>{t('nav.agent', '伙伴')}</span>
            </div>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        {!isOnboarding && (
          <>
            {s3Configured && (
              <div style={{ marginRight: '8px' }}>
                <IncrementalSyncPanel
                  onSync={startSync}
                  isConfigured={s3Configured}
                  isSyncing={isSyncing}
                  progress={progress}
                />
              </div>
            )}

            <div
              className={styles.vaultSwitcherWrapper}
              ref={vaultMenuRef}
              style={{ position: 'relative' }}
            >
              <WorkspaceScopeHelpTooltip size={15} className={styles.vaultHelpIcon} />
              <div
                className={styles.vaultSwitcher}
                onClick={() => !isSwitchingVault && setShowVaultMenu(!showVaultMenu)}
                style={{ opacity: isSwitchingVault ? 0.65 : 1 }}
              >
                <MdFolderShared className={styles.actionIconSm} />
                <span className={styles.vaultName}>
                  {isSwitchingVault
                    ? t('workspace.switching', 'Switching…')
                    : activeVault?.name || ''}
                </span>
                <MdArrowDropDown className={styles.actionIconSm} />
              </div>
              {showVaultMenu && vaults.length > 0 && (
                <div
                  className={styles.vaultMenu}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '4px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 1000,
                    minWidth: '150px',
                    padding: '4px'
                  }}
                >
                  {vaults.map((v, i) => (
                    <div
                      key={i}
                      onMouseEnter={() => preloadVault(v.name)}
                      onClick={() => handleSwitchVault(v.name)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '13px',
                        color:
                          v.name === activeVault?.name
                            ? 'var(--color-primary)'
                            : 'var(--text-primary)',
                        background:
                          v.name === activeVault?.name ? 'rgba(91,168,245,0.08)' : 'transparent'
                      }}
                    >
                      {v.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.divider}></div>
          </>
        )}

        <div className={styles.windowControls}>
          <button
            className={styles.winBtn}
            onClick={() => (window as any).api?.window?.minimize()}
            title={t('titlebar.minimize', '最小化')}
          >
            <MdMinimize />
          </button>
          <button
            className={styles.winBtn}
            onClick={() => (window as any).api?.window?.toggleMaximize()}
            title={t('titlebar.maximize', '最大化')}
          >
            <MdCropSquare />
          </button>
          <button
            className={`${styles.winBtn} ${styles.winCloseBtn}`}
            onClick={() => (window as any).api?.window?.close()}
            title={t('titlebar.close', '关闭')}
          >
            <MdClose />
          </button>
        </div>
      </div>
    </div>
  )
}
