import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type {
  IncrementalSyncPlanAction,
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
  formatIncrementalSyncPlanBytes,
  type SyncDeletePropagationChoice
} from '@baishou/shared'
import { Modal } from '@baishou/ui'
import styles from './IncrementalSyncConfirmDialog.module.css'

interface IncrementalSyncConfirmDialogProps {
  open: boolean
  preview: IncrementalSyncPlanPreview | null
  confirmEligibleAtMs: number | null
  isConfirming?: boolean
  onConfirm: (choice?: SyncDeletePropagationChoice) => void
  onCancel: () => void
}

const PLAN_ACTION_ORDER: IncrementalSyncPlanAction[] = [
  'conflict-resolved',
  'delete-local',
  'delete-remote',
  'upload',
  'download'
]

function actionDotClass(action: IncrementalSyncPlanAction): string {
  switch (action) {
    case 'upload':
      return styles.dotUpload
    case 'download':
      return styles.dotDownload
    case 'delete-local':
    case 'delete-remote':
      return styles.dotDelete
    case 'conflict-resolved':
      return styles.dotConflict
    default:
      return styles.dotUpload
  }
}

function actionLabelKey(action: IncrementalSyncPlanAction): string {
  return `data_sync.plan_action_${action.replace(/-/g, '_')}`
}

function groupPlanItemsByAction(items: IncrementalSyncPlanItem[]) {
  const groups = new Map<IncrementalSyncPlanAction, IncrementalSyncPlanItem[]>()
  for (const item of items) {
    const bucket = groups.get(item.action)
    if (bucket) bucket.push(item)
    else groups.set(item.action, [item])
  }
  return PLAN_ACTION_ORDER.flatMap((action) => {
    const grouped = groups.get(action)
    return grouped && grouped.length > 0 ? [{ action, items: grouped }] : []
  })
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

const PREVIEW_FILE_LIMIT = 6

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
  const [expandedVaults, setExpandedVaults] = useState<Set<string>>(() => new Set())
  const [pendingChoice, setPendingChoice] = useState<SyncDeletePropagationChoice | null>(null)

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

  const choiceDisabled = (needsSyncConfirm && !confirmReady) || isConfirming

  useEffect(() => {
    if (!open) {
      setExpandedVaults(new Set())
      setPendingChoice(null)
      return undefined
    }

    if (!isConfirming) setPendingChoice(null)
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
  }, [open, needsSyncConfirm, confirmEligibleAtMs, isConfirming])

  const handleDeleteChoice = (choice: SyncDeletePropagationChoice) => {
    if (choiceDisabled) return
    setPendingChoice(choice)
    onConfirm(choice)
  }

  if (!open || !preview) return null

  const renderChoiceOption = (
    choice: SyncDeletePropagationChoice,
    titleKey: string,
    titleFallback: string,
    hintKey: string,
    hintFallback: string,
    variant: 'default' | 'danger' = 'default'
  ) => {
    const pending = pendingChoice === choice
    return (
      <button
        type="button"
        className={`${styles.choiceOption} ${variant === 'danger' ? styles.choiceOptionDanger : ''}`}
        disabled={choiceDisabled}
        onClick={() => handleDeleteChoice(choice)}
      >
        <span className={styles.choiceOptionTitle}>
          {pending ? t('data_sync.plan_confirming', '正在确认…') : t(titleKey, titleFallback)}
        </span>
        <span className={styles.choiceOptionHint}>{t(hintKey, hintFallback)}</span>
      </button>
    )
  }

  return (
    <Modal
      isOpen={open}
      onClose={onCancel}
      closeOnOverlayClick
      animation="fade"
      className={styles.modalShell}
      zIndex={1200}
    >
      <div className={styles.dialog}>
        <header className={styles.header}>
          <h2 className={styles.title}>{t('data_sync.plan_confirm_title', '确认同步')}</h2>
          <p className={styles.subtitle}>
            {t('data_sync.plan_confirm_desc', {
              count: preview.changeCount,
              activeVault: preview.activeVaultName ?? t('workspace.no_active', '未选择工作空间')
            })}
          </p>
          <div className={styles.metaRow}>
            <span className={styles.metaChip}>
              {t('data_sync.plan_traffic_summary', {
                download: formatIncrementalSyncPlanBytes(preview.totalDownloadBytes),
                upload: formatIncrementalSyncPlanBytes(preview.totalUploadBytes),
                defaultValue: '下载 {{download}} · 上传 {{upload}}'
              })}
            </span>
            {typeof preview.renamedFileCount === 'number' && preview.renamedFileCount > 0 ? (
              <span className={styles.metaChip}>
                {t('data_sync.plan_rename_summary', {
                  count: preview.renamedFileCount,
                  defaultValue: '云端重命名 {{count}} 个文件'
                })}
              </span>
            ) : null}
          </div>
        </header>

        <div className={styles.body}>
          {boundaryHints.map((hint, index) => (
            <p key={`boundary-${index}`} className={`${styles.callout} ${styles.calloutWarning}`}>
              {hint}
            </p>
          ))}

          {preview.autoRegisteredVaults && preview.autoRegisteredVaults.length > 0 && (
            <p className={`${styles.callout} ${styles.calloutInfo}`}>
              {t('data_sync.plan_auto_registered_vaults', {
                vaults: preview.autoRegisteredVaults.join('、')
              })}
            </p>
          )}

          {preview.prunedRegistryVaults && preview.prunedRegistryVaults.length > 0 && (
            <p className={`${styles.callout} ${styles.calloutWarning}`}>
              {t('data_sync.plan_warning_pruned_registry_vaults', {
                vaults: preview.prunedRegistryVaults.join('、')
              })}
            </p>
          )}

          {needsDeleteChoice && (
            <div className={`${styles.callout} ${styles.calloutDanger}`}>
              <h3 className={styles.calloutTitle}>
                {t(getDeletePropagationChoiceTitleKey(preview.deletePropagationReason))}
              </h3>
              <p className={styles.calloutDesc}>
                {t(getDeletePropagationChoiceDescKey(preview.deletePropagationReason))}
              </p>
              {preview.blockedDeleteCount != null && preview.blockedDeleteCount > 0 && (
                <p className={styles.calloutMeta}>
                  {t('data_sync.plan_delete_choice_blocked_count', {
                    count: preview.blockedDeleteCount
                  })}
                </p>
              )}
            </div>
          )}

          {otherWarnings.length > 0 && (
            <div className={styles.warningStack}>
              {otherWarnings.map((key) => (
                <p key={key} className={`${styles.callout} ${styles.calloutWarning}`}>
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
              <p className={styles.emptyHint}>
                {t('data_sync.plan_no_file_changes', '没有需要同步的文件变更')}
              </p>
            ) : (
              preview.vaultSummaries.map((summary) => {
                const vaultItems = itemsByVault.get(summary.vaultName) ?? []
                const isExpanded = expandedVaults.has(summary.vaultName)
                const displayItems = isExpanded
                  ? vaultItems
                  : vaultItems.slice(0, PREVIEW_FILE_LIMIT)
                const hiddenCount = isExpanded ? 0 : vaultItems.length - displayItems.length
                const isActive = summary.vaultName === preview.activeVaultName
                const isRegistered =
                  summary.vaultName === '__root__' ||
                  summary.vaultName === '__unknown__' ||
                  registeredSet.has(summary.vaultName)
                const statsText = formatVaultStats(summary, t)
                const groupedDisplay = groupPlanItemsByAction(displayItems)
                const groupedAll = groupPlanItemsByAction(vaultItems)

                return (
                  <section key={summary.vaultName} className={styles.vaultSection}>
                    <div
                      className={`${styles.vaultHeader}${
                        groupedDisplay.length > 0 ? ` ${styles.vaultHeaderWithFiles}` : ''
                      }`}
                    >
                      <div className={styles.vaultTitleRow}>
                        <span className={styles.vaultName}>
                          {formatVaultLabel(summary.vaultName, t)}
                        </span>
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
                      {statsText && <p className={styles.vaultStats}>{statsText}</p>}
                    </div>
                    {groupedDisplay.map((group) => {
                      const totalForAction =
                        groupedAll.find((item) => item.action === group.action)?.items.length ??
                        group.items.length
                      return (
                        <div key={group.action} className={styles.fileGroup}>
                          <div className={styles.fileGroupLabel}>
                            <span
                              className={`${styles.fileGroupDot} ${actionDotClass(group.action)}`}
                            />
                            {t(actionLabelKey(group.action), group.action)}
                            <span className={styles.fileGroupCount}>{totalForAction}</span>
                          </div>
                          <ul className={styles.fileList}>
                            {group.items.map((item) => (
                              <li
                                key={`${item.action}:${item.filePath}`}
                                className={styles.filePath}
                              >
                                {item.filePath}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })}
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        className={styles.moreHintButton}
                        onClick={() =>
                          setExpandedVaults((prev) => new Set(prev).add(summary.vaultName))
                        }
                      >
                        {t('data_sync.plan_more_files', { count: hiddenCount })}
                      </button>
                    )}
                    {isExpanded && vaultItems.length > PREVIEW_FILE_LIMIT && (
                      <button
                        type="button"
                        className={styles.moreHintButton}
                        onClick={() =>
                          setExpandedVaults((prev) => {
                            const next = new Set(prev)
                            next.delete(summary.vaultName)
                            return next
                          })
                        }
                      >
                        {t('data_sync.plan_show_less', '收起文件列表')}
                      </button>
                    )}
                  </section>
                )
              })
            )}
          </div>
        </div>

        <footer className={styles.footer}>
          {needsDeleteChoice ? (
            <>
              <div className={styles.footerBar}>
                {needsSyncConfirm && !confirmReady ? (
                  <p className={styles.countdownHint}>
                    {t('data_sync.plan_confirm_countdown', {
                      seconds: secondsLeft,
                      defaultValue: '请仔细阅读变更列表，{{seconds}} 秒后可确认'
                    })}
                  </p>
                ) : (
                  <span />
                )}
                <button type="button" className={styles.footerCancel} onClick={onCancel}>
                  {t('common.cancel', '取消')}
                </button>
              </div>
              <div className={styles.choiceList}>
                {renderChoiceOption(
                  'skip-deletes',
                  'data_sync.plan_delete_choice_skip_deletes_title',
                  '仅同步其他变更',
                  'data_sync.plan_delete_choice_skip_deletes_hint',
                  '本次跳过删除，只处理上传、下载和其他变更'
                )}
                {renderChoiceOption(
                  'push-local',
                  'data_sync.plan_delete_choice_push_local_title',
                  '以本机为准',
                  'data_sync.plan_delete_choice_push_local_hint',
                  '把本机文件上传并恢复到云端'
                )}
                {renderChoiceOption(
                  'follow-remote',
                  'data_sync.plan_delete_choice_follow_remote_title',
                  '跟随云端',
                  'data_sync.plan_delete_choice_follow_remote_hint',
                  '删除本机中云端已没有的文件',
                  'danger'
                )}
              </div>
            </>
          ) : (
            <div className={styles.actionsRow}>
              <button type="button" className={styles.btnGhost} onClick={onCancel}>
                {t('common.cancel', '取消')}
              </button>
              <button
                type="button"
                className={styles.btnConfirm}
                disabled={choiceDisabled}
                onClick={() => onConfirm()}
              >
                {primaryButtonLabel}
              </button>
            </div>
          )}
        </footer>
      </div>
    </Modal>
  )
}
