import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Database, RefreshCw, Sparkles } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import type { RagStats } from './rag-memory.types'
import { ragMemoryStyles as styles } from './rag-memory.styles'

interface RagMemoryStatsSectionProps {
  stats: RagStats
  embeddingModelId?: string
  isBusy?: boolean
  onConfigureModel?: () => void
  onDetectDimension?: () => Promise<void>
}

export const RagMemoryStatsSection: React.FC<RagMemoryStatsSectionProps> = ({
  stats,
  embeddingModelId,
  isBusy,
  onConfigureModel,
  onDetectDimension
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const dimensionText = stats.currentDimension > 0 ? String(stats.currentDimension) : '—'

  return (
    <View style={styles.statsRow}>
      <View
        style={[
          styles.statChip,
          {
            backgroundColor: colors.primaryLight,
            borderColor: colors.primaryTrackMuted
          }
        ]}
      >
        <Database size={14} color={colors.primary} strokeWidth={DEFAULT_STROKE_WIDTH} />
        <Text style={[styles.statValue, { color: colors.primary }]}>
          {stats.diaryCountForVault != null ? stats.diaryCountForVault : stats.totalCount}
        </Text>
        <Text style={[styles.statLabel, { color: colors.primary }]}>
          {stats.diaryCountForVault != null && stats.activeVaultName
            ? t('settings.rag_vault_diary_count', {
                vault: stats.activeVaultName,
                defaultValue: '{{vault}} 日记向量'
              })
            : t('settings.rag_total_count')}
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.statChip,
          {
            backgroundColor: colors.bgSurfaceHigh,
            borderColor: colors.borderMuted
          }
        ]}
        onPress={onConfigureModel}
        disabled={!onConfigureModel}
        activeOpacity={0.7}
      >
        <Sparkles size={14} color={colors.success} strokeWidth={DEFAULT_STROKE_WIDTH} />
        <Text
          style={[styles.statValue, { color: colors.success }]}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {embeddingModelId ?? t('settings.not_set')}
        </Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
          {t('settings.rag_model')}
        </Text>
      </TouchableOpacity>

      <View
        style={[
          styles.statChip,
          {
            backgroundColor: colors.bgSurfaceHigh,
            borderColor: colors.borderMuted
          }
        ]}
      >
        <Database size={14} color={colors.textSecondary} strokeWidth={DEFAULT_STROKE_WIDTH} />
        <Text style={[styles.statValue, { color: colors.textPrimary }]}>{dimensionText}</Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
          {t('settings.rag_dimension')}
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.statChip,
          {
            backgroundColor: colors.primaryLight,
            borderColor: colors.primaryTrackMuted,
            opacity: isBusy ? 0.5 : 1
          }
        ]}
        onPress={() => void onDetectDimension?.()}
        disabled={isBusy || !onDetectDimension}
        activeOpacity={0.7}
      >
        <RefreshCw size={14} color={colors.primary} strokeWidth={DEFAULT_STROKE_WIDTH} />
        <Text style={[styles.statValue, { color: colors.primary, fontSize: 12 }]} numberOfLines={2}>
          {t('settings.rag_detect_dimension')}
        </Text>
      </TouchableOpacity>
    </View>
  )
}
