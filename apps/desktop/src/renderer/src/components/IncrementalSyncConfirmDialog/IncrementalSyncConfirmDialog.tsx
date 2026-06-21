import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  IncrementalSyncPlanItem,
  IncrementalSyncPlanPreview,
  IncrementalSyncVaultSummary
} from '@baishou/shared'
import {
  SYNC_CONFIRM_DELAY_MS,
  computeSyncConfirmSecondsLeft,
  isSyncConfirmReady
} from '@baishou/shared'
import styles from './IncrementalSyncConfirmDialog.module.css'

interface IncrementalSyncConfirmDialogProps {
  open: boolean
  preview: IncrementalSyncPlanPreview | null
  isConfirming?: boolean
  onConfirm: () => void
  onCancel: () => void
}

function actionClass(action: IncrementalSyncPlanItem['action']): string {
  switch (action) {
    case 'upload':
      return styles.actionUpload
    case 'download':
      return styles.actionDownload
    case 'delete-local':
      return styles.actionDeleteLocal
    case 'delete-remote':
      return styles.actionDeleteRemote
    case 'conflict-resolved':
      return styles.actionConflict
    default:
      return styles.actionUpload
  }
}

function formatVaultStats(
  summary: IncrementalSyncVaultSummary,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  const parts: string[] = []
  if (summary.upload > 0) {
    parts.push(t('data_sync.plan_stat_upload', { count: summary.upload }))
  }
  if (summary.download > 0) {
    parts.push(t('data_sync.plan_stat_download', { count: summary.download }))
  }
  if (summary.deleteLocal > 0) {
    parts.push(t('data_sync.plan_stat_delete_local', { count: summary.deleteLocal }))
  }
  if (summary.deleteRemote > 0) {
    parts.push(t('data_sync.plan_stat_delete_remote', { count: summary.deleteRemote }))
  }
  if (summary.conflict > 0) {
    parts.push(t('data_sync.plan_stat_conflict', { count: summary.conflict }))
  }
  return parts.join(' · ')
}

function formatVaultLabel(vaultName: string, t: (key: string, fallback?: string) => string): string {
  if (vaultName === '__root__') return t('data_sync.plan_vault_root', '根目录文件')
  if (vaultName === '__unknown__') return t('data_sync.plan_vault_unknown', '未知工作区')
  return vaultName
}

export const IncrementalSyncConfirmDialog: React.FC<IncrementalSyncConfirmDialogProps> = ({
  open,
  preview,
  isConfirming = false,
  onConfirm,
  onCancel
}) => {
  const { t } = useTranslation()
  const [confirmReady, setConfirmReady] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(2)

  const canExecuteSync = Boolean(
    preview && preview.changeCount > 0 && !preview.deletePropagationBlocked
  )

  const registeredSet = useMemo(
    () => new Set(preview?.registeredVaults ?? []),
    [preview?.registeredVaults]
  )

  const itemsByVault = useMemo(() => {
    if (!preview) return new Map<string, IncrementalSyncPlanItem[]>()
    const map = new Map<string, IncrementalSyncPlanItem[]>()
    for (const item of preview.items) {
      const bucket = map.get(item.vaultScope) ?? []
      bucket.push(item)
      map.set(item.vaultScope, bucket)
    }
    return map
  }, [preview])

  const boundaryHints = useMemo(() => {
    if (!preview) return [] as string[]
    const { boundaryIssues } = preview
    const hints: string[] = []
    if (boundaryIssues.unknownVaultPaths.length > 0) {
      hints.push(
        t('data_sync.plan_warning_unknown_vault_paths', {
          paths: boundaryIssues.unknownVaultPaths.join('、')
        })
      )
    }
    if (boundaryIssues.diskVaultsNotInRegistry.length > 0) {
      hints.push(
        t('data_sync.plan_warning_disk_vaults_not_in_registry', {
          vaults: boundaryIssues.diskVaultsNotInRegistry.join('、')
        })
      )
    }
    if (boundaryIssues.registryVaultsMissingOnDisk.length > 0) {
      hints.push(
        t('data_sync.plan_warning_registry_vaults_missing_on_disk', {
          missing: boundaryIssues.registryVaultsMissingOnDisk.join('、')
        })
      )
    }
    return hints
  }, [preview, t])

  const otherWarnings = useMemo(() => {
    if (!preview) return []
    const boundaryKeys = new Set([
      'data_sync.plan_warning_unknown_vault_paths',
      'data_sync.plan_warning_disk_vaults_not_in_registry',
      'data_sync.plan_warning_registry_vaults_missing_on_disk'
    ])
    return preview.warnings.filter((key) => !boundaryKeys.has(key))
  }, [preview])

  useEffect(() => {
    if (!open) {
      setConfirmReady(false)
      setSecondsLeft(2)
      return undefined
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)

    if (!canExecuteSync) {
      setConfirmReady(true)
      setSecondsLeft(0)
      return () => window.removeEventListener('keydown', onKeyDown)
    }

    setConfirmReady(false)
    setSecondsLeft(2)
    const startedAt = Date.now()
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt
      setSecondsLeft(computeSyncConfirmSecondsLeft(elapsed, SYNC_CONFIRM_DELAY_MS))
      if (isSyncConfirmReady(elapsed, SYNC_CONFIRM_DELAY_MS)) {
        setConfirmReady(true)
        window.clearInterval(interval)
      }
    }, 200)

    const timer = window.setTimeout(() => {
      setConfirmReady(true)
      setSecondsLeft(0)
    }, SYNC_CONFIRM_DELAY_MS)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.clearInterval(interval)
      window.clearTimeout(timer)
    }
  }, [open, canExecuteSync, preview?.changeCount, preview?.deletePropagationBlocked, onCancel])

  if (!open || !preview) return null

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2 className={styles.title}>{t('data_sync.plan_confirm_title', '确认同步')}</h2>
        <p className={styles.subtitle}>
          {t('data_sync.plan_confirm_desc', {
            count: preview.changeCount,
            activeVault: preview.activeVaultName ?? t('workspace.no_active', '未选择工作空间')
          })}
        </p>

        {boundaryHints.map((hint, index) => (
          <p key={`boundary-${index}`} className={styles.warningItem}>
            {hint}
          </p>
        ))}

        {preview.autoRegisteredVaults && preview.autoRegisteredVaults.length > 0 && (
          <p className={styles.infoItem}>
            {t('data_sync.plan_auto_registered_vaults', {
              vaults: preview.autoRegisteredVaults.join('、')
            })}
          </p>
        )}

        {otherWarnings.length > 0 && (
          <div className={styles.warnings}>
            {otherWarnings.map((key) => (
              <p key={key} className={styles.warningItem}>
                {t(key, {
                  divergence: preview.divergencePercent,
                  limit: preview.maxDivergencePercent
                })}
              </p>
            ))}
          </div>
        )}

        <div className={styles.vaultList}>
          {preview.vaultSummaries.length === 0 ? (
            <p className={styles.subtitle}>{t('data_sync.plan_no_file_changes', '没有需要同步的文件变更')}</p>
          ) : (
            preview.vaultSummaries.map((summary) => {
              const vaultItems = itemsByVault.get(summary.vaultName) ?? []
              const displayItems = vaultItems.slice(0, 6)
              const hiddenCount = vaultItems.length - displayItems.length
              const isActive = summary.vaultName === preview.activeVaultName
              const isRegistered =
                summary.vaultName === '__root__' ||
                summary.vaultName === '__unknown__' ||
                registeredSet.has(summary.vaultName)

              return (
                <section key={summary.vaultName} className={styles.vaultSection}>
                  <div className={styles.vaultHeader}>
                    <div className={styles.vaultTitleRow}>
                      <span className={styles.vaultName}>{formatVaultLabel(summary.vaultName, t)}</span>
                      <div className={styles.vaultTags}>
                        {isActive && (
                          <span className={styles.vaultBadgeActive}>
                            {t('data_sync.plan_active_vault', '当前')}
                          </span>
                        )}
                        {!isRegistered && (
                          <span className={styles.vaultBadgeUnregistered}>
                            {t('data_sync.plan_unregistered_vault', '未注册')}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={styles.vaultStats}>{formatVaultStats(summary, t)}</span>
                  </div>
                  {displayItems.length > 0 && (
                    <ul className={styles.fileList}>
                      {displayItems.map((item) => (
                        <li key={`${item.action}:${item.filePath}`} className={styles.fileItem}>
                          <span className={`${styles.actionTag} ${actionClass(item.action)}`}>
                            {t(`data_sync.plan_action_${item.action.replace(/-/g, '_')}`, item.action)}
                          </span>
                          <span className={styles.filePath}>{item.filePath}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {hiddenCount > 0 && (
                    <p className={styles.moreHint}>
                      {t('data_sync.plan_more_files', { count: hiddenCount })}
                    </p>
                  )}
                </section>
              )
            })
          )}
        </div>

        {canExecuteSync && !confirmReady && (
          <p className={styles.countdownHint}>
            {t('data_sync.plan_confirm_countdown', { seconds: secondsLeft })}
          </p>
        )}

        <div className={styles.actions}>
          <button type="button" className={`${styles.btn} ${styles.btnCancel}`} onClick={onCancel}>
            {t('common.cancel', '取消')}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnConfirm} ${
              preview.deletePropagationBlocked ? styles.btnConfirmDanger : ''
            }`}
            disabled={!confirmReady || preview.deletePropagationBlocked || isConfirming}
            onClick={onConfirm}
          >
            {isConfirming
              ? t('data_sync.plan_confirming', '正在确认…')
              : canExecuteSync
              ? t('data_sync.plan_confirm_sync', '确认同步')
              : t('common.close', '关闭')}
          </button>
        </div>
      </div>
    </div>
  )
}
