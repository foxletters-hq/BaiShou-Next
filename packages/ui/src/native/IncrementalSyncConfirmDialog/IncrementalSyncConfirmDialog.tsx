import React, { useEffect, useMemo, useState, memo } from 'react'
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
  type ViewStyle
} from 'react-native'
import { useTranslation } from 'react-i18next'
import type {
  IncrementalSyncPlanItem,
  IncrementalSyncPlanPreview,
  IncrementalSyncVaultSummary
} from '@baishou/shared'
import {
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

/** 仅在秒数变化或倒计时结束时更新，避免高频 setState 打断 ScrollView 手势 */
function useSyncConfirmCountdown(
  needsSyncConfirm: boolean,
  confirmEligibleAtMs: number | null
): { confirmReady: boolean; secondsLeft: number } {
  const [state, setState] = useState(() => ({
    confirmReady: !needsSyncConfirm || confirmEligibleAtMs == null,
    secondsLeft:
      needsSyncConfirm && confirmEligibleAtMs != null
        ? computeSyncConfirmSecondsLeftUntil(confirmEligibleAtMs)
        : 0
  }))

  useEffect(() => {
    if (!needsSyncConfirm || confirmEligibleAtMs == null) {
      setState({ confirmReady: true, secondsLeft: 0 })
      return undefined
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const sync = () => {
      const now = Date.now()
      const confirmReady = isSyncConfirmEligible(confirmEligibleAtMs, now)
      const secondsLeft = computeSyncConfirmSecondsLeftUntil(confirmEligibleAtMs, now)
      setState((prev) =>
        prev.confirmReady === confirmReady && prev.secondsLeft === secondsLeft
          ? prev
          : { confirmReady, secondsLeft }
      )
      return confirmReady
    }

    if (sync()) {
      return undefined
    }

    const schedule = () => {
      if (cancelled) return
      if (sync()) return

      const now = Date.now()
      const msUntilEligible = Math.max(0, confirmEligibleAtMs - now)
      const msUntilNextSecond = 1000 - (now % 1000)
      const delay =
        msUntilEligible > 0 ? Math.min(msUntilNextSecond, msUntilEligible) : msUntilNextSecond
      timer = setTimeout(schedule, Math.max(delay, 50))
    }

    schedule()

    return () => {
      cancelled = true
      if (timer != null) clearTimeout(timer)
    }
  }, [needsSyncConfirm, confirmEligibleAtMs])

  return state
}

type PlanScrollContentProps = {
  preview: IncrementalSyncPlanPreview
}

const PlanScrollContent = memo(function PlanScrollContent({ preview }: PlanScrollContentProps) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const registeredSet = useMemo(
    () => new Set(preview.registeredVaults ?? []),
    [preview.registeredVaults]
  )

  const itemsByVault = useMemo(() => {
    const map = new Map<string, IncrementalSyncPlanItem[]>()
    for (const item of preview.items) {
      const bucket = map.get(item.vaultScope) ?? []
      bucket.push(item)
      map.set(item.vaultScope, bucket)
    }
    return map
  }, [preview.items])

  const boundaryHints = useMemo(() => {
    return buildIncrementalSyncBoundaryHints(preview.boundaryIssues).map((hint) =>
      t(hint.messageKey, { [hint.listParam]: hint.names.join('、') })
    )
  }, [preview.boundaryIssues, t])

  const needsDeleteChoice = requiresExplicitDeletePropagationChoice(preview)

  const otherWarnings = useMemo(() => {
    const boundaryKeys = new Set([
      'data_sync.plan_warning_unknown_vault_paths',
      'data_sync.plan_warning_disk_vaults_not_in_registry',
      'data_sync.plan_warning_registry_vaults_missing_on_disk'
    ])
    const skipKeys = new Set(['data_sync.plan_warning_delete_blocked'])
    return preview.warnings.filter((key) => !boundaryKeys.has(key) && !skipKeys.has(key))
  }, [preview.warnings])

  return (
    <ScrollView
      style={styles.scrollBody}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator
      nestedScrollEnabled
      scrollEventThrottle={16}
    >
      {boundaryHints.map((hint, index) => (
        <Text key={`boundary-${index}`} style={[styles.warningItem, { color: colors.warning }]}>
          {hint}
        </Text>
      ))}

      {preview.prunedRegistryVaults && preview.prunedRegistryVaults.length > 0 && (
        <Text style={[styles.warningItem, { color: colors.warning }]}>
          {t('data_sync.plan_warning_pruned_registry_vaults', {
            vaults: preview.prunedRegistryVaults.join('、')
          })}
        </Text>
      )}

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
            limit: preview.maxDivergencePercent,
            completed: preview.interruptedSyncResume?.completed,
            total: preview.interruptedSyncResume?.total
          })}
        </Text>
      ))}

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
  )
})

type PlanConfirmFooterProps = {
  preview: IncrementalSyncPlanPreview
  confirmEligibleAtMs: number | null
  isConfirming: boolean
  onConfirm: (choice?: SyncDeletePropagationChoice) => void
  onCancel: () => void
}

const PlanConfirmFooter = memo(function PlanConfirmFooter({
  preview,
  confirmEligibleAtMs,
  isConfirming,
  onConfirm,
  onCancel
}: PlanConfirmFooterProps) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const needsSyncConfirm = canExecuteIncrementalSyncPlan(preview)
  const needsDeleteChoice = requiresExplicitDeletePropagationChoice(preview)
  const { confirmReady, secondsLeft } = useSyncConfirmCountdown(
    needsSyncConfirm,
    confirmEligibleAtMs
  )
  const [activeDeleteChoice, setActiveDeleteChoice] =
    useState<SyncDeletePropagationChoice | null>(null)

  useEffect(() => {
    if (!isConfirming) {
      setActiveDeleteChoice(null)
    }
  }, [isConfirming])

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

  const choiceDisabled =
    (needsSyncConfirm && !confirmReady) || isConfirming || activeDeleteChoice != null

  const handleDeleteChoiceConfirm = (choice: SyncDeletePropagationChoice) => {
    if (choiceDisabled) return
    setActiveDeleteChoice(choice)
    onConfirm(choice)
  }

  if (needsDeleteChoice) {
    return (
      <View style={[styles.deleteChoiceFooter, { borderTopColor: colors.borderSubtle }]}>
        <Button
          variant="primary"
          destructive
          onPress={() => handleDeleteChoiceConfirm('follow-remote')}
          disabled={choiceDisabled}
          isLoading={activeDeleteChoice === 'follow-remote'}
          style={styles.fullWidthButton}
        >
          {t('data_sync.plan_delete_choice_follow_remote')}
        </Button>
        <Button
          variant="primary"
          onPress={() => handleDeleteChoiceConfirm('push-local')}
          disabled={choiceDisabled}
          isLoading={activeDeleteChoice === 'push-local'}
          style={styles.fullWidthButton}
        >
          {t('data_sync.plan_delete_choice_push_local')}
        </Button>
        <Button
          variant="outline"
          onPress={() => handleDeleteChoiceConfirm('skip-deletes')}
          disabled={choiceDisabled}
          isLoading={activeDeleteChoice === 'skip-deletes'}
          style={styles.fullWidthButton}
        >
          {t('data_sync.plan_delete_choice_skip_deletes')}
        </Button>
        <Button variant="outline" onPress={onCancel} disabled={choiceDisabled} style={styles.fullWidthButton}>
          {t('common.cancel', '取消')}
        </Button>
      </View>
    )
  }

  return (
    <View style={[styles.actionsRow, { borderTopColor: colors.borderSubtle }]}>
      <Button variant="outline" onPress={onCancel} style={styles.actionButton}>
        {t('common.cancel', '取消')}
      </Button>
      <Button
        variant="primary"
        onPress={() => onConfirm()}
        disabled={choiceDisabled}
        isLoading={isConfirming}
        style={styles.actionButton}
      >
        {primaryButtonLabel}
      </Button>
    </View>
  )
})

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
  const { height: windowHeight } = useWindowDimensions()
  const dialogHeight = Math.min(Math.floor(windowHeight * 0.82), windowHeight - 32)

  if (!visible || !preview) return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel', '取消')}
        />

        <View style={styles.dialogWrap} pointerEvents="box-none">
          <View
            style={[
              styles.dialog,
              {
                height: dialogHeight,
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle
              }
            ]}
          >
            <View style={styles.headerBlock}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {t('data_sync.plan_confirm_title', '确认同步')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {t('data_sync.plan_confirm_desc', {
                  count: preview.changeCount,
                  activeVault: preview.activeVaultName ?? t('workspace.no_active', '未选择工作空间')
                })}
              </Text>
            </View>

            <PlanScrollContent preview={preview} />

            <PlanConfirmFooter
              preview={preview}
              confirmEligibleAtMs={confirmEligibleAtMs}
              isConfirming={isConfirming}
              onConfirm={onConfirm}
              onCancel={onCancel}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16
  },
  dialogWrap: {
    width: '100%',
    alignItems: 'center',
    zIndex: 2
  },
  dialog: {
    width: '100%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    flexDirection: 'column'
  },
  headerBlock: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
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
  scrollBody: {
    flex: 1,
    minHeight: 0
  },
  scrollContent: {
    paddingHorizontal: 18,
    gap: 10,
    paddingBottom: 8
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
  deleteChoiceFooter: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8
  },
  fullWidthButton: {
    width: '100%',
    alignSelf: 'stretch'
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  actionButton: {
    flex: 1
  }
})
