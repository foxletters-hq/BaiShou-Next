import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import styles from './TitleBar.module.css'
import { useTranslation } from 'react-i18next'
import { isIncrementalSyncReady } from '@baishou/shared'
import { IncrementalSyncPanel, WorkspaceScopeHelpTooltip } from '@baishou/ui'

import { resolveDiaryHomePath } from '../Sidebar/sidebar-preferences'
import { useOrchestratedSync } from '../../hooks/useOrchestratedSync'
import { switchActiveVault, persistActiveVaultName } from '../../lib/vault-runtime.util'
import { INCREMENTAL_SYNC_CONFIG_CHANGED_EVENT } from '../../lib/incremental-sync-config-events'
import { BookOpen, ChevronDown, FolderSync, LayoutPanelLeft, Minus, Square, X } from 'lucide-react'

export const TitleBar: React.FC = () => {
  const { t } = useTranslation()

  const location = useLocation()
  const navigate = useNavigate()
  const isOnboarding = location.pathname.startsWith('/welcome')

  const [vaults, setVaults] = useState<any[]>([])
  const [activeVault, setActiveVault] = useState<any>(null)
  const [showVaultMenu, setShowVaultMenu] = useState(false)
  const [isSwitchingVault, setIsSwitchingVault] = useState(false)
  const vaultMenuRef = useRef<HTMLDivElement>(null)
  const wasOnboardingRef = useRef(isOnboarding)
  const preloadedVaultsRef = useRef<Set<string>>(new Set())
  const [s3Configured, setS3Configured] = useState(false)
  const { isSyncing, isPlanning, progress, startSync } = useOrchestratedSync()

  const fetchVaults = useCallback(async (): Promise<boolean> => {
    try {
      const [vList, active] = await Promise.all([
        (window as any).api?.vault?.list(),
        (window as any).api?.vault?.getActive()
      ])
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
    const wasOnboarding = wasOnboardingRef.current
    wasOnboardingRef.current = isOnboarding
    if (wasOnboarding && !isOnboarding) {
      void fetchVaults()
    }
  }, [isOnboarding, fetchVaults])

  useEffect(() => {
    const unsubRegistry = (window as any).api?.vault?.onRegistryUpdated?.(() => {
      void fetchVaults()
    })
    const unsubMutation = (window as any).api?.cache?.onDomainMutation?.(
      (event: { domain?: string; action?: string }) => {
        if (event.domain === 'vault' && event.action === 'switch') {
          void fetchVaults()
        }
      }
    )
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

    const fetchSyncConfig = async () => {
      try {
        const cfg = await (window as any).api?.incrementalSync?.getConfig?.()
        if (!cancelled) setS3Configured(isIncrementalSyncReady(cfg))
        retries = 0
      } catch {
        if (!cancelled && retries < 5) {
          retries++
          retryTimer = setTimeout(fetchSyncConfig, 1000)
        }
      }
    }

    void fetchSyncConfig()
    window.addEventListener(INCREMENTAL_SYNC_CONFIG_CHANGED_EVENT, fetchSyncConfig)

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      window.removeEventListener(INCREMENTAL_SYNC_CONFIG_CHANGED_EVENT, fetchSyncConfig)
    }
  }, [isOnboarding])

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

  // 顶栏双主场：日记 | 工作台（伙伴已迁入日记侧栏）
  const isAgentWorkspace = location.pathname.startsWith('/agent-workspace')
  const isSettings = location.pathname.startsWith('/settings')
  const isDiaryTab = !isAgentWorkspace && !isSettings

  return (
    <div className={`${styles.titleBar} ${isOnboarding ? styles.titleBarOnboarding : ''}`}>
      <div className={styles.dragRegion}>
        {!isOnboarding && (
          <div className={styles.tabsContainer}>
            <div
              className={`${styles.tab} ${isDiaryTab ? styles.activeTab : ''}`}
              onClick={() => navigate(resolveDiaryHomePath())}
            >
              <BookOpen className={styles.tabIcon} />
              <span>{t('nav.diary', '日记')}</span>
            </div>
            <div
              className={`${styles.tab} ${isAgentWorkspace ? styles.activeTab : ''}`}
              onClick={() => navigate('/agent-workspace')}
            >
              <LayoutPanelLeft className={styles.tabIcon} />
              <span>{t('nav.workbench', '工作台')}</span>
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

            {!isAgentWorkspace ? (
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
                  <FolderSync className={styles.actionIconSm} />
                  <span className={styles.vaultName}>
                    {isSwitchingVault
                      ? t('workspace.switching', 'Switching…')
                      : activeVault?.name || t('workspace.no_active', '未选择工作空间')}
                  </span>
                  <ChevronDown className={styles.actionIconSm} />
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
            ) : null}

            <div className={styles.divider}></div>
          </>
        )}

        <div className={styles.windowControls}>
          <button
            className={styles.winBtn}
            onClick={() => (window as any).api?.window?.minimize()}
            title={t('titlebar.minimize', '最小化')}
          >
            <Minus />
          </button>
          <button
            className={styles.winBtn}
            onClick={() => (window as any).api?.window?.toggleMaximize()}
            title={t('titlebar.maximize', '最大化')}
          >
            <Square />
          </button>
          <button
            className={`${styles.winBtn} ${styles.winCloseBtn}`}
            onClick={() => (window as any).api?.window?.close()}
            title={t('titlebar.close', '关闭')}
          >
            <X />
          </button>
        </div>
      </div>
    </div>
  )
}
