import React, { useMemo, useState, memo } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { IncrementalSyncPlanItem, IncrementalSyncPlanPreview } from '@baishou/shared'
import {
  buildIncrementalSyncBoundaryHints,
  requiresExplicitDeletePropagationChoice,
  getDeletePropagationChoiceTitleKey,
  getDeletePropagationChoiceDescKey
} from '@baishou/shared'
import { useNativeTheme } from '../theme'
import {
  actionTagStyle,
  collectOtherSyncWarnings,
  formatVaultLabel,
  formatVaultStats
} from './incremental-sync-confirm.util'
import { incrementalSyncConfirmStyles as styles } from './incremental-sync-confirm.styles'

const PREVIEW_FILE_LIMIT = 6

export const PlanScrollContent = memo(function PlanScrollContent({
  preview
}: {
  preview: IncrementalSyncPlanPreview
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [expandedVaults, setExpandedVaults] = useState<Set<string>>(() => new Set())

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
  const otherWarnings = useMemo(
    () => collectOtherSyncWarnings(preview.warnings),
    [preview.warnings]
  )

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
          const isExpanded = expandedVaults.has(summary.vaultName)
          const displayItems = isExpanded ? vaultItems : vaultItems.slice(0, PREVIEW_FILE_LIMIT)
          const hiddenCount = isExpanded ? 0 : vaultItems.length - displayItems.length
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
                      actionTagStyle(item.action),
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
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setExpandedVaults((prev) => new Set(prev).add(summary.vaultName))}
                >
                  <Text style={[styles.moreHint, { color: colors.primary }]}>
                    {t('data_sync.plan_more_files', { count: hiddenCount })}
                  </Text>
                </Pressable>
              )}
              {isExpanded && vaultItems.length > PREVIEW_FILE_LIMIT && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    setExpandedVaults((prev) => {
                      const next = new Set(prev)
                      next.delete(summary.vaultName)
                      return next
                    })
                  }
                >
                  <Text style={[styles.moreHint, { color: colors.primary }]}>
                    {t('data_sync.plan_show_less', '收起文件列表')}
                  </Text>
                </Pressable>
              )}
            </View>
          )
        })
      )}
    </ScrollView>
  )
})
