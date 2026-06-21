import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import styles from './TitleBar.module.css'
import {
  MdAutoStories,
  MdAutoAwesome,
  MdMinimize,
  MdCropSquare,
  MdClose,
  MdFolderShared,
  MdArrowDropDown
} from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { isIncrementalSyncReady, buildAgentChatNavigationPath } from '@baishou/shared'
import { IncrementalSyncPanel, WorkspaceScopeHelpTooltip } from '@baishou/ui'

import { resolveDiaryHomePath } from '../Sidebar/sidebar-preferences'
import { useOrchestratedSync } from '../../hooks/useOrchestratedSync'
import { readActiveVaultNavigationSnapshot } from '../../lib/agent-navigation-persistence'
import { switchActiveVault, persistActiveVaultName } from '../../lib/vault-runtime.util'

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
  const { isSyncing, isPlanning, progress, startSync } = useOrchestratedSync()

  const fetchVaults = useCallback(async (): Promise<boolean> => {
    try {
      const vList = await (window as any).api?.vault?.list()
      const active = await (window as any).api?.vault?.getActive()
      if (Array.isArray(vList)) setVaults(vList)
      if (active?.name) {
        setActiveVault(active)
        persistActiveVaultName(active.name)
      }
      return Array.isArray(vList) && vList.length > 0
    } catch {
      return false
    }
  }, [])

  // TitleBar 在引导页即挂载，vault 系统可能尚未就绪；需持续重试并在进入主界面后再拉一次
  useEffect(() => {
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let retries = 0
    const maxRetries = 120

    const pollVaults = async () => {
      if (cancelled) return
      const ready = await fetchVaults()
      if (ready || retries >= maxRetries) return
      retries++
      timeoutId = setTimeout(pollVaults, 500)
    }

    void pollVaults()
    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [fetchVaults])

  useEffect(() => {
    if (location.pathname.startsWith('/welcome')) return
    void fetchVaults()
  }, [location.pathname, fetchVaults])

  useEffect(() => {
    const unsubRegistry = (window as any).api?.vault?.onRegistryUpdated?.(() => {
      void fetchVaults()
    })
    const unsubMutation = (window as any).api?.cache?.onDomainMutation?.((event: {
      domain?: string
      action?: string
    }) => {
      if (event.domain === 'vault' && event.action === 'switch') {
        void fetchVaults()
      }
    })
    return () => {
      unsubRegistry?.()
      unsubMutation?.()
    }
  }, [fetchVaults])

  useEffect(() => {
    if (!showVaultMenu) return undefined

    const handleClickOutside = (e: MouseEvent) => {
      if (vaultMenuRef.current?.contains(e.target as Node)) return
      setShowVaultMenu(false)
    }

    // 延迟注册，避免与打开菜单的同一次点击冲突
    const timerId = window.setTimeout(() => {
      document.addEventListener('click', handleClickOutside, true)
    }, 0)

    return () => {
      clearTimeout(timerId)
      document.removeEventListener('click', handleClickOutside, true)
    }
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
    setShowVaultMenu(false)
    try {
      await switchActiveVault(vaultName)
      await fetchVaults()
    } catch (e) {
      console.error(e)
    } finally {
      setIsSwitchingVault(false)
    }
  }

  const toggleVaultMenu = () => {
    if (isSwitchingVault) return
    setShowVaultMenu((open) => {
      const next = !open
      if (next && vaults.length === 0) {
        void fetchVaults()
      }
      return next
    })
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
              onClick={() => {
                const saved = readActiveVaultNavigationSnapshot()
                navigate(saved ? buildAgentChatNavigationPath(saved) : '/chat')
              }}
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
              <div className={styles.syncPanelWrap}>
                <IncrementalSyncPanel
                  onSync={startSync}
                  isConfigured={s3Configured}
                  isSyncing={isSyncing || isPlanning}
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
              <button
                type="button"
                className={styles.vaultSwitcher}
                onClick={toggleVaultMenu}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={isSwitchingVault}
                aria-expanded={showVaultMenu}
                aria-haspopup="menu"
                style={{ opacity: isSwitchingVault ? 0.65 : 1 }}
              >
                <MdFolderShared className={styles.actionIconSm} />
                <span className={styles.vaultName}>
                  {isSwitchingVault
                    ? t('workspace.switching', 'Switching…')
                    : activeVault?.name || t('workspace.no_active', '未选择工作空间')}
                </span>
                <MdArrowDropDown className={styles.actionIconSm} />
              </button>
              {showVaultMenu && (
                <div className={styles.vaultMenu} role="menu">
                  {vaults.length > 0 ? (
                    vaults.map((v) => (
                      <button
                        key={v.name}
                        type="button"
                        role="menuitem"
                        className={`${styles.vaultMenuItem} ${
                          v.name === activeVault?.name ? styles.vaultMenuItemActive : ''
                        }`}
                        onMouseEnter={() => preloadVault(v.name)}
                        onClick={() => void handleSwitchVault(v.name)}
                      >
                        {v.name}
                      </button>
                    ))
                  ) : (
                    <div className={styles.vaultMenuPlaceholder} role="presentation">
                      {t('common.loading', '加载中…')}
                    </div>
                  )}
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
