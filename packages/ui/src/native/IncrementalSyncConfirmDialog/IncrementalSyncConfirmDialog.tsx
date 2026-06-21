import React, { useEffect, useMemo, useState } from 'react'
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  type ViewStyle
} from 'react-native'
import { useTranslation } from 'react-i18next'
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
import { Button } from '../Button'
import { useNativeTheme } from '../theme'

export interface IncrementalSyncConfirmDialogProps {
  visible: boolean
  preview: IncrementalSyncPlanPreview | null
  confirmEligibleAtMs: number | null
  isConfirming?: boolean
  onConfirm: (choice?: SyncDeletePropagationChoice) => void
  onCancel: () => void
}

function actionStyle(action: IncrementalSyncPlanItem['action']): ViewStyle {
  switch (action) {
    case 'upload':
      return { backgroundColor: 'rgba(59, 130, 246, 0.14)' }
    case 'download':
      return { backgroundColor: 'rgba(16, 185, 129, 0.14)' }
    case 'delete-local':
    case 'delete-remote':
      return { backgroundColor: 'rgba(239, 68, 68, 0.14)' }
    case 'conflict-resolved':
      return { backgroundColor: 'rgba(245, 158, 11, 0.14)' }
    default:
      return { backgroundColor: 'rgba(59, 130, 246, 0.14)' }
  }
}

function formatVaultStats(
  summary: IncrementalSyncVaultSummary,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  const parts: string[] = []
  if (summary.upload > 0) parts.push(t('data_sync.plan_stat_upload', { count: summary.upload }))
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
  visible,
  preview,
  confirmEligibleAtMs,
  isConfirming = false,
  onConfirm,
  onCancel
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
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

  useEffect(() => {
    if (!visible) return undefined

    setNowMs(Date.now())

    if (!needsSyncConfirm || confirmEligibleAtMs == null) {
      return undefined
    }

    const interval = setInterval(() => {
      setNowMs(Date.now())
    }, 200)

    return () => {
      clearInterval(interval)
    }
  }, [visible, needsSyncConfirm, confirmEligibleAtMs])

  if (!visible || !preview) return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable
          style={[
            styles.dialog,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle
            }
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t('data_sync.plan_confirm_title', '确认同步')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('data_sync.plan_confirm_desc', {
              count: preview.changeCount,
              activeVault: preview.activeVaultName ?? t('workspace.no_active', '未选择工作空间')
            })}
          </Text>

          {boundaryHints.map((hint, index) => (
            <Text key={`boundary-${index}`} style={[styles.warningItem, { color: colors.warning }]}>
              {hint}
            </Text>
          ))}

          {needsDeleteChoice && (
            <View
              style={[
                styles.choicePanel,
                {
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  borderColor: 'rgba(239, 68, 68, 0.25)'
                }
              ]}
            >
              <Text style={[styles.choiceTitle, { color: colors.textPrimary }]}>
                {t(getDeletePropagationChoiceTitleKey(preview.deletePropagationReason))}
              </Text>
              <Text style={[styles.choiceDesc, { color: colors.textSecondary }]}>
                {t(getDeletePropagationChoiceDescKey(preview.deletePropagationReason))}
              </Text>
              {preview.blockedDeleteCount != null && preview.blockedDeleteCount > 0 && (
                <Text style={[styles.choiceMeta, { color: colors.textTertiary }]}>
                  {t('data_sync.plan_delete_choice_blocked_count', {
                    count: preview.blockedDeleteCount
                  })}
                </Text>
              )}
            </View>
          )}

          {otherWarnings.map((key) => (
            <Text key={key} style={[styles.warningItem, { color: colors.warning }]}>
              {t(key, {
                divergence: preview.divergencePercent,
                limit: preview.maxDivergencePercent
              })}
            </Text>
          ))}

          <ScrollView style={styles.vaultList} contentContainerStyle={styles.vaultListContent}>
            {preview.vaultSummaries.length === 0 ? (
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {t('data_sync.plan_no_file_changes', '没有需要同步的文件变更')}
              </Text>
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
                  <View
                    key={summary.vaultName}
                    style={[styles.vaultSection, { borderColor: colors.borderSubtle }]}
                  >
                    <View style={styles.vaultHeader}>
                      <View style={styles.vaultTitleRow}>
                        <Text style={[styles.vaultName, { color: colors.textPrimary }]}>
                          {formatVaultLabel(summary.vaultName, t)}
                        </Text>
                        <View style={styles.vaultTags}>
                          {isActive && (
                            <Text style={[styles.badgeActive, { color: colors.primary }]}>
                              {t('data_sync.plan_active_vault', '当前')}
                            </Text>
                          )}
                          {!isRegistered && (
                            <Text style={[styles.badgeUnregistered, { color: colors.warning }]}>
                              {t('data_sync.plan_unregistered_vault', '未注册')}
                            </Text>
                          )}
                        </View>
                      </View>
                      {statsText.length > 0 && (
                        <Text style={[styles.vaultStats, { color: colors.textTertiary }]}>
                          {statsText}
                        </Text>
                      )}
                    </View>
                    {displayItems.map((item) => (
                      <View key={`${item.action}:${item.filePath}`} style={styles.fileItem}>
                        <Text
                          style={[
                            styles.actionTag,
                            actionStyle(item.action),
                            { color: colors.textPrimary }
                          ]}
                        >
                          {t(`data_sync.plan_action_${item.action.replace(/-/g, '_')}`, item.action)}
                        </Text>
                        <Text
                          style={[styles.filePath, { color: colors.textSecondary }]}
                          numberOfLines={2}
                        >
                          {item.filePath}
                        </Text>
                      </View>
                    ))}
                    {hiddenCount > 0 && (
                      <Text style={[styles.moreHint, { color: colors.textTertiary }]}>
                        {t('data_sync.plan_more_files', { count: hiddenCount })}
                      </Text>
                    )}
                  </View>
                )
              })
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Button variant="outline" onPress={onCancel} style={styles.actionButton}>
              {t('common.cancel', '取消')}
            </Button>
            {needsDeleteChoice ? (
              <View style={styles.choiceActions}>
                <Button
                  variant="primary"
                  destructive
                  onPress={() => onConfirm('follow-remote')}
                  disabled={(needsSyncConfirm && !confirmReady) || isConfirming}
                  isLoading={isConfirming}
                  style={styles.choiceButton}
                >
                  {t('data_sync.plan_delete_choice_follow_remote')}
                </Button>
                <Button
                  variant="primary"
                  onPress={() => onConfirm('push-local')}
                  disabled={(needsSyncConfirm && !confirmReady) || isConfirming}
                  style={styles.choiceButton}
                >
                  {t('data_sync.plan_delete_choice_push_local')}
                </Button>
                <Button
                  variant="outline"
                  onPress={() => onConfirm('skip-deletes')}
                  disabled={(needsSyncConfirm && !confirmReady) || isConfirming}
                  style={styles.choiceButton}
                >
                  {t('data_sync.plan_delete_choice_skip_deletes')}
                </Button>
              </View>
            ) : (
              <Button
                variant="primary"
                onPress={() => onConfirm()}
                disabled={(needsSyncConfirm && !confirmReady) || isConfirming}
                isLoading={isConfirming}
                style={styles.actionButton}
              >
                {primaryButtonLabel}
              </Button>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  dialog: {
    maxHeight: '82%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 10
  },
  title: {
    fontSize: 17,
    fontWeight: '700'
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20
  },
  warningItem: {
    fontSize: 12,
    lineHeight: 18,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.1)'
  },
  vaultList: {
    maxHeight: 320
  },
  vaultListContent: {
    gap: 8,
    paddingBottom: 4
  },
  vaultSection: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 10,
    gap: 6
  },
  vaultHeader: {
    gap: 4
  },
  vaultTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6
  },
  vaultName: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    flexGrow: 1
  },
  vaultTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  badgeActive: {
    fontSize: 11,
    fontWeight: '600'
  },
  badgeUnregistered: {
    fontSize: 11,
    fontWeight: '600'
  },
  vaultStats: {
    fontSize: 11,
    alignSelf: 'flex-end'
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8
  },
  actionTag: {
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden'
  },
  filePath: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16
  },
  moreHint: {
    fontSize: 11
  },
  countdownHint: {
    fontSize: 11,
    textAlign: 'right'
  },
  choicePanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 10,
    gap: 6
  },
  choiceTitle: {
    fontSize: 14,
    fontWeight: '600'
  },
  choiceDesc: {
    fontSize: 12,
    lineHeight: 18
  },
  choiceMeta: {
    fontSize: 11
  },
  choiceActions: {
    flex: 1,
    gap: 8
  },
  choiceButton: {
    width: '100%'
  },
  actions: {
    flexDirection: 'row',
    gap: 10
  },
  actionButton: {
    flex: 1
  }
})
