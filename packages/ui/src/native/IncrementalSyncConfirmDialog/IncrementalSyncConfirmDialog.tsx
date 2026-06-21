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
  SYNC_CONFIRM_DELAY_MS,
  computeSyncConfirmSecondsLeft,
  isSyncConfirmReady,
  buildIncrementalSyncBoundaryHints
} from '@baishou/shared'
import { Button } from '../Button'
import { useNativeTheme } from '../theme'

export interface IncrementalSyncConfirmDialogProps {
  visible: boolean
  preview: IncrementalSyncPlanPreview | null
  isConfirming?: boolean
  onConfirm: () => void
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
  isConfirming = false,
  onConfirm,
  onCancel
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
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
    return buildIncrementalSyncBoundaryHints(preview.boundaryIssues).map((hint) =>
      t(hint.messageKey, { [hint.listParam]: hint.names.join('、') })
    )
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
    if (!visible) {
      setConfirmReady(false)
      setSecondsLeft(2)
      return undefined
    }

    if (!canExecuteSync) {
      setConfirmReady(true)
      setSecondsLeft(0)
      return undefined
    }

    setConfirmReady(false)
    setSecondsLeft(2)
    const startedAt = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt
      setSecondsLeft(computeSyncConfirmSecondsLeft(elapsed, SYNC_CONFIRM_DELAY_MS))
      if (isSyncConfirmReady(elapsed, SYNC_CONFIRM_DELAY_MS)) {
        setConfirmReady(true)
        clearInterval(interval)
      }
    }, 200)

    const timer = setTimeout(() => {
      setConfirmReady(true)
      setSecondsLeft(0)
    }, SYNC_CONFIRM_DELAY_MS)

    return () => {
      clearInterval(interval)
      clearTimeout(timer)
    }
  }, [visible, canExecuteSync, preview?.changeCount, preview?.deletePropagationBlocked])

  if (!visible || !preview) return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" />
        <View
          style={[
            styles.dialog,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle
            }
          ]}
        >
          <View style={styles.dialogHeader}>
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

            {otherWarnings.map((key) => (
              <Text key={key} style={[styles.warningItem, { color: colors.warning }]}>
                {t(key, {
                  divergence: preview.divergencePercent,
                  limit: preview.maxDivergencePercent
                })}
              </Text>
            ))}
          </View>

          <ScrollView
            style={styles.vaultList}
            contentContainerStyle={styles.vaultListContent}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
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

          <View style={styles.dialogFooter}>
            {canExecuteSync && !confirmReady && (
              <Text style={[styles.countdownHint, { color: colors.textTertiary }]}>
                {t('data_sync.plan_confirm_countdown', { seconds: secondsLeft })}
              </Text>
            )}

            <View style={styles.actions}>
              <Button variant="outline" onPress={onCancel} style={styles.actionButton}>
                {t('common.cancel', '取消')}
              </Button>
              <Button
                variant="primary"
                destructive={preview.deletePropagationBlocked}
                onPress={onConfirm}
                disabled={!confirmReady || preview.deletePropagationBlocked || isConfirming}
                isLoading={isConfirming}
                style={styles.actionButton}
              >
                {isConfirming
                  ? t('data_sync.plan_confirming', '正在确认…')
                  : canExecuteSync
                    ? t('data_sync.plan_confirm_sync', '确认同步')
                    : t('common.close', '关闭')}
              </Button>
            </View>
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
    paddingHorizontal: 16
  },
  dialog: {
    maxHeight: '82%',
    width: '100%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    zIndex: 1
  },
  dialogHeader: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
    gap: 10
  },
  dialogFooter: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
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
    flexGrow: 0,
    flexShrink: 1,
    maxHeight: 360
  },
  vaultListContent: {
    gap: 8,
    paddingHorizontal: 18,
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
  actions: {
    flexDirection: 'row',
    gap: 10
  },
  actionButton: {
    flex: 1
  }
})
