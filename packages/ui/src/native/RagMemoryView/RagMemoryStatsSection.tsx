import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
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
        <MaterialCommunityIcons name="database-outline" size={14} color={colors.primary} />
        <Text style={[styles.statValue, { color: colors.primary }]}>{stats.totalCount}</Text>
        <Text style={[styles.statLabel, { color: colors.primary }]}>
          {t('settings.rag_total_count')}
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
        <MaterialCommunityIcons name="hub" size={14} color={colors.success} />
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
        <MaterialCommunityIcons name="vector-combine" size={14} color={colors.textSecondary} />
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
        <MaterialCommunityIcons name="refresh" size={14} color={colors.primary} />
        <Text style={[styles.statValue, { color: colors.primary, fontSize: 12 }]} numberOfLines={2}>
          {t('settings.rag_detect_dimension')}
        </Text>
      </TouchableOpacity>
    </View>
  )
}
