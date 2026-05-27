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
import { IncrementalSyncPanel } from '@baishou/ui'
import type { SyncProgress } from '@baishou/ui'

import { useSyncStore } from '@baishou/store'

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
    if (!activeVault) return undefined
    let cancelled = false
    let retryTimer: any
    let retries = 0
    const fetchConfig = async () => {
      try {
        const cfg = await (window as any).api?.incrementalSync?.getConfig?.()
        if (!cancelled) setS3Configured(!!cfg?.enabled)
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
      clearTimeout(retryTimer)
    }
  }, [activeVault])

  const handleOrchestratedSync = async (): Promise<SyncProgress> => {
    const { setStatus, setMessage, setSyncResult, setProgress } = useSyncStore.getState()
    setStatus('syncing')
    setMessage('正在同步...')
    setSyncResult(null)
    setProgress(null)
    try {
      const result = await (window as any).api?.incrementalSync?.orchestratedSync()
      setSyncResult(result)
      setProgress(null)
      setMessage('同步完成')
      setStatus('success')
      return result
    } catch (e: any) {
      const errorMsg = e?.message || '未知错误'
      let friendlyMsg = errorMsg.replace(/^Error:\s*/i, '')
      friendlyMsg = friendlyMsg.replace(/^Error invoking remote method '.*?':\s*/i, '')
      if (
        friendlyMsg.includes('SyncInProgressError') ||
        friendlyMsg.includes('already in progress')
      ) {
        friendlyMsg = '同步操作正在进行中，请勿重复操作'
      } else if (
        friendlyMsg.includes('not initialized') ||
        friendlyMsg.includes('Please update config first')
      ) {
        friendlyMsg = '同步服务尚未初始化，请先配置并保存您的连接信息'
      } else if (friendlyMsg.includes('S3NotConfiguredError')) {
        friendlyMsg = '同步服务尚未启用或配置不完整'
      } else if (friendlyMsg.includes('InvalidAccessKeyId')) {
        friendlyMsg = 'Access Key 无效或已过期，请在设置中更新您的密钥'
      } else if (
        friendlyMsg.includes('SignatureDoesNotMatch') ||
        (friendlyMsg.includes('signature') && friendlyMsg.includes('does not match'))
      ) {
        friendlyMsg = 'Secret Key 无效，请在设置中更新您的密钥'
      } else if (friendlyMsg.includes('AccessDenied')) {
        friendlyMsg = '访问被拒绝，请检查 Bucket 权限或密钥配置'
      } else if (friendlyMsg.includes('NoSuchBucket')) {
        friendlyMsg = 'Bucket 不存在，请检查 Bucket 名称配置'
      } else if (friendlyMsg.includes('ENOTFOUND') || friendlyMsg.includes('getaddrinfo')) {
        friendlyMsg = '无法解析域名，请检查 Endpoint 地址和网络连接'
      } else if (friendlyMsg.includes('ECONNREFUSED')) {
        friendlyMsg = '连接被拒绝，请检查 Endpoint 地址和服务是否在线'
      } else {
        friendlyMsg = `同步失败: ${friendlyMsg}`
      }
      setMessage(friendlyMsg)
      setStatus('error')
      setProgress(null)
      throw e
    }
  }

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
              onClick={() => {
                try {
                  const saved = localStorage.getItem('desktop_sidebar_nav_order')
                  if (saved) {
                    const parsed = JSON.parse(saved)
                    if (Array.isArray(parsed) && parsed.length > 0) {
                      const paths: Record<string, string> = {
                        diary: '/diary',
                        summary: '/summary',
                        lan: '/lan-transfer',
                        sync: '/data-sync',
                        git: '/git'
                      }
                      if (paths[parsed[0]]) {
                        navigate(paths[parsed[0]])
                        return
                      }
                    }
                  }
                } catch (e) {}
                navigate('/diary')
              }}
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
                  onSync={handleOrchestratedSync}
                  isConfigured={s3Configured}
                  onSyncProgress={(cb) => (window as any).api?.incrementalSync?.onSyncProgress(cb)}
                />
              </div>
            )}

            <div
              className={styles.vaultSwitcherWrapper}
              ref={vaultMenuRef}
              style={{ position: 'relative' }}
            >
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
