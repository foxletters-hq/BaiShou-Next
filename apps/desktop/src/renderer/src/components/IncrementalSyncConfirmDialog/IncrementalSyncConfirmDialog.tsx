import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type {
  IncrementalSyncPlanItem,
  IncrementalSyncPlanPreview,
  IncrementalSyncVaultSummary
} from '@baishou/shared'
import {
  SYNC_CONFIRM_DELAY_SECONDS,
  canExecuteIncrementalSyncPlan,
  computeSyncConfirmSecondsLeftUntil,
  isSyncConfirmEligible,
  buildIncrementalSyncBoundaryHints,
  requiresExplicitDeletePropagationChoice,
  getDeletePropagationChoiceTitleKey,
  getDeletePropagationChoiceDescKey,
  type SyncDeletePropagationChoice
} from '@baishou/shared'
import styles from './IncrementalSyncConfirmDialog.module.css'

interface IncrementalSyncConfirmDialogProps {
  open: boolean
  preview: IncrementalSyncPlanPreview | null
  confirmEligibleAtMs: number | null
  isConfirming?: boolean
  onConfirm: (choice?: SyncDeletePropagationChoice) => void
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

function formatVaultLabel(vaultName: string, t: TFunction): string {
  if (vaultName === '__root__') return t('data_sync.plan_vault_root', '根目录文件')
  if (vaultName === '__unknown__') return t('data_sync.plan_vault_unknown', '未知工作区')
  return vaultName
}

export const IncrementalSyncConfirmDialog: React.FC<IncrementalSyncConfirmDialogProps> = ({
  open,
  preview,
  confirmEligibleAtMs,
  isConfirming = false,
  onConfirm,
  onCancel
}) => {
  const { t } = useTranslation()
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel
  const [nowMs, setNowMs] = useState(() => Date.now())

  const needsSyncConfirm = Boolean(preview && canExecuteIncrementalSyncPlan(preview))

  const confirmReady = useMemo(() => {
    if (!needsSyncConfirm) return true
    if (confirmEligibleAtMs == null) return false
    return isSyncConfirmEligible(confirmEligibleAtMs, nowMs)
  }, [needsSyncConfirm, confirmEligibleAtMs, nowMs])

  const secondsLeft = useMemo(() => {
    if (!needsSyncConfirm) return 0
    if (confirmEligibleAtMs == null) return SYNC_CONFIRM_DELAY_SECONDS
    return computeSyncConfirmSecondsLeftUntil(confirmEligibleAtMs, nowMs)
  }, [needsSyncConfirm, confirmEligibleAtMs, nowMs])

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
    return buildIncrementalSyncBoundaryHints(preview.boundaryIssues).map((hint) =>
      t(hint.messageKey, { [hint.listParam]: hint.names.join('、') })
    )
  }, [preview, t])

  const needsDeleteChoice = Boolean(preview && requiresExplicitDeletePropagationChoice(preview))

  const otherWarnings = useMemo(() => {
    if (!preview) return []
    const boundaryKeys = new Set([
      'data_sync.plan_warning_unknown_vault_paths',
      'data_sync.plan_warning_disk_vaults_not_in_registry',
      'data_sync.plan_warning_registry_vaults_missing_on_disk'
    ])
    const skipKeys = new Set(['data_sync.plan_warning_delete_blocked'])
    return preview.warnings.filter((key) => !boundaryKeys.has(key) && !skipKeys.has(key))
  }, [preview])

  const primaryButtonLabel = useMemo(() => {
    if (isConfirming) return t('data_sync.plan_confirming', '正在确认…')
    if (!needsSyncConfirm) return t('common.close', '关闭')
    if (!confirmReady) {
      return t('data_sync.plan_confirm_sync_countdown', {
        seconds: secondsLeft,
        defaultValue: '确认同步 ({{seconds}})'
      })
    }
    return t('data_sync.plan_confirm_sync', '确认同步')
  }, [confirmReady, isConfirming, needsSyncConfirm, secondsLeft, t])

  useEffect(() => {
    if (!open) return undefined

    setNowMs(Date.now())

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancelRef.current()
    }
    window.addEventListener('keydown', onKeyDown)

    if (!needsSyncConfirm || confirmEligibleAtMs == null) {
      return () => window.removeEventListener('keydown', onKeyDown)
    }

    const interval = window.setInterval(() => {
      setNowMs(Date.now())
    }, 200)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.clearInterval(interval)
    }
  }, [open, needsSyncConfirm, confirmEligibleAtMs])

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

        {preview.prunedRegistryVaults && preview.prunedRegistryVaults.length > 0 && (
          <p className={styles.warningItem}>
            {t('data_sync.plan_warning_pruned_registry_vaults', {
              vaults: preview.prunedRegistryVaults.join('、')
            })}
          </p>
        )}

        {needsDeleteChoice && (
          <div className={styles.choicePanel}>
            <h3 className={styles.choiceTitle}>
              {t(getDeletePropagationChoiceTitleKey(preview.deletePropagationReason))}
            </h3>
            <p className={styles.choiceDesc}>
              {t(getDeletePropagationChoiceDescKey(preview.deletePropagationReason))}
            </p>
            {preview.blockedDeleteCount != null && preview.blockedDeleteCount > 0 && (
              <p className={styles.choiceMeta}>
                {t('data_sync.plan_delete_choice_blocked_count', {
                  count: preview.blockedDeleteCount
                })}
              </p>
            )}
          </div>
        )}

        {otherWarnings.length > 0 && (
          <div className={styles.warnings}>
            {otherWarnings.map((key) => (
              <p key={key} className={styles.warningItem}>
                {t(key, {
                  divergence: preview.divergencePercent,
                  limit: preview.maxDivergencePercent,
                  completed: preview.interruptedSyncResume?.completed,
                  total: preview.interruptedSyncResume?.total
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
              const statsText = formatVaultStats(summary, t)

              return (
                <section key={summary.vaultName} className={styles.vaultSection}>
                  <div
                    className={`${styles.vaultHeader} ${
                      displayItems.length > 0 ? styles.vaultHeaderWithFiles : ''
                    }`}
                  >
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
                    {statsText && <span className={styles.vaultStats}>{statsText}</span>}
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

        <div className={styles.actions}>
          <button type="button" className={`${styles.btn} ${styles.btnCancel}`} onClick={onCancel}>
            {t('common.cancel', '取消')}
          </button>
          {needsDeleteChoice ? (
            <div className={styles.choiceActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnChoiceDanger}`}
                disabled={(needsSyncConfirm && !confirmReady) || isConfirming}
                onClick={() => onConfirm('follow-remote')}
              >
                {t('data_sync.plan_delete_choice_follow_remote')}
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnChoice}`}
                disabled={(needsSyncConfirm && !confirmReady) || isConfirming}
                onClick={() => onConfirm('push-local')}
              >
                {t('data_sync.plan_delete_choice_push_local')}
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnChoiceMuted}`}
                disabled={(needsSyncConfirm && !confirmReady) || isConfirming}
                onClick={() => onConfirm('skip-deletes')}
              >
                {t('data_sync.plan_delete_choice_skip_deletes')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnConfirm}`}
              disabled={(needsSyncConfirm && !confirmReady) || isConfirming}
              onClick={() => onConfirm()}
            >
              {primaryButtonLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
