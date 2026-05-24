import React, { useState, useCallback, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { SyncProgressEvent } from '@baishou/shared'
import { useToast } from '../Toast/useToast'
import styles from './IncrementalSyncPanel.module.css'

export interface SyncProgress {
  uploaded: number
  downloaded: number
  deletedRemote: number
  deletedLocal: number
  conflicts: number
  skipped: number
  duration: number
  sessionId: string
}

export interface IncrementalSyncPanelProps {
  onSync: () => Promise<SyncProgress>
  isConfigured: boolean
  onSyncProgress?: (callback: (event: SyncProgressEvent) => void) => () => void
}

export const IncrementalSyncPanel: React.FC<IncrementalSyncPanelProps> = ({
  onSync,
  isConfigured,
  onSyncProgress
}) => {
  const { t } = useTranslation()
  const toast = useToast()
  const [isSyncing, setIsSyncing] = useState(false)
  const [progress, setProgress] = useState<SyncProgressEvent | null>(null)

  useEffect(() => {
    if (!onSyncProgress) return undefined
    const unsub = onSyncProgress((event) => {
      setProgress(event)
    })
    return unsub
  }, [onSyncProgress])

  const handleSync = useCallback(async () => {
    if (isSyncing || !isConfigured) return
    setIsSyncing(true)
    setProgress(null)

    try {
      await onSync()
      setProgress(null)
      toast.showSuccess(t('data_sync.sync_completed', '同步成功'))
    } catch (e: any) {
      toast.showError(friendlySyncError(e?.message || ''))
      setProgress(null)
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing, isConfigured, onSync, t, toast])

  const friendlySyncError = (msg: string): string => {
    if (!msg) return t('data_sync.sync_failed', '同步失败')
    let cleanMsg = msg.replace(/^Error:\s*/i, '')
    cleanMsg = cleanMsg.replace(/^Error invoking remote method '.*?':\s*/i, '')

    if (cleanMsg.includes('SyncInProgressError') || cleanMsg.includes('already in progress')) {
      return t('data_sync.error_in_progress', '同步操作正在进行中，请勿重复操作')
    }
    if (cleanMsg.includes('not initialized') || cleanMsg.includes('Please update config first')) {
      return t('data_sync.error_not_initialized', '同步服务尚未初始化，请先配置并保存您的连接信息')
    }
    if (cleanMsg.includes('S3NotConfiguredError')) {
      return t('data_sync.error_not_configured', '同步服务尚未启用或配置不完整')
    }
    if (cleanMsg.includes('InvalidAccessKeyId')) {
      return t(
        'data_sync.error_invalid_access_key',
        'Access Key 无效或已过期，请在设置中更新您的密钥'
      )
    }
    if (
      cleanMsg.includes('SignatureDoesNotMatch') ||
      (cleanMsg.includes('signature') && cleanMsg.includes('does not match'))
    ) {
      return t('data_sync.error_invalid_secret', 'Secret Key 无效，请在设置中更新您的密钥')
    }
    if (cleanMsg.includes('AccessDenied')) {
      return t('data_sync.error_access_denied', '访问被拒绝，请检查 Bucket 权限或密钥配置')
    }
    if (cleanMsg.includes('NoSuchBucket')) {
      return t('data_sync.error_no_bucket', 'Bucket 不存在，请检查 Bucket 名称配置')
    }
    if (cleanMsg.includes('ENOTFOUND') || cleanMsg.includes('getaddrinfo')) {
      return t('data_sync.error_dns', '无法解析域名，请检查 Endpoint 地址和网络连接')
    }
    if (cleanMsg.includes('ECONNREFUSED')) {
      return t('data_sync.error_conn_refused', '连接被拒绝，请检查 Endpoint 地址和服务是否在线')
    }
    return t('data_sync.sync_failed', '同步失败') + `: ${cleanMsg}`
  }

  return (
    <>
      <div className={styles.container}>
        <button
          className={`${styles.syncButton} ${isSyncing ? styles.syncing : ''} ${!isConfigured ? styles.disabled : ''}`}
          onClick={handleSync}
          disabled={isSyncing || !isConfigured}
          title={
            isConfigured ? t('data_sync.sync_now', '同步') : t('common.not_configured', '未配置')
          }
        >
          <RefreshCw
            size={16}
            className={`${styles.syncIcon} ${isSyncing ? styles.spinning : ''}`}
          />
          <span className={styles.syncLabel}>
            {isSyncing ? t('data_sync.syncing', '同步中...') : t('data_sync.sync_now', '同步')}
          </span>
        </button>

        <AnimatePresence>
          {isSyncing && progress && progress.total > 0 && (
            <motion.div
              className={styles.progressBarContainer}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${Math.round((progress.current / progress.total) * 100)}%`
                  }}
                />
              </div>
              <div className={styles.progressText}>
                {progress.current}/{progress.total}
                {progress.statusText && ` · ${progress.statusText}`}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
