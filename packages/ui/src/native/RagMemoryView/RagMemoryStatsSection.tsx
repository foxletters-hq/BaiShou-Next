import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import type { RagStats } from './rag-memory.types'
import { ragMemoryStyles as styles } from './rag-memory.styles'

interface RagMemoryStatsSectionProps {
  stats: RagStats
  embeddingModelId?: string
  isBusy?: boolean
  onNavigateToConfig?: () => void
  onDetectDimension?: () => Promise<void>
}

export const RagMemoryStatsSection: React.FC<RagMemoryStatsSectionProps> = ({
  stats,
  embeddingModelId,
  isBusy,
  onNavigateToConfig,
  onDetectDimension
}: RagMemoryStatsSectionProps) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  return (
    <View
      style={[
        styles.statsCard,
        {
          marginHorizontal: tokens.spacing.lg,
          marginBottom: tokens.spacing.md
        }
      ]}
    >
      <View style={styles.statsRow}>
        <View
          style={[
            styles.statChip,
            {
              backgroundColor: colors.primaryLight,
              borderColor: 'rgba(91, 168, 245, 0.2)'
            }
          ]}
        >
          <Text style={[styles.statValue, { color: colors.primary }]}>{stats.totalCount}</Text>
          <Text style={[styles.statLabel, { color: colors.primary }]}>
            {t('settings.rag_total_count')}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.statChip,
            {
              backgroundColor: 'rgba(74, 222, 128, 0.08)',
              borderColor: 'rgba(74, 222, 128, 0.2)'
            }
          ]}
          onPress={onNavigateToConfig}
          disabled={!onNavigateToConfig}
          activeOpacity={0.7}
        >
          <Text style={[styles.statValue, { color: colors.success }]} numberOfLines={1}>
            {embeddingModelId ?? t('settings.rag_model_unassigned')}
          </Text>
          <Text style={[styles.statLabel, { color: colors.success }]}>
            {t('settings.rag_model')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.statChip,
            {
              backgroundColor: colors.bgSurfaceHigh,
              borderColor: colors.borderMuted
            }
          ]}
          onPress={() => void onDetectDimension?.()}
          disabled={isBusy || !onDetectDimension}
          activeOpacity={0.7}
        >
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            {stats.currentDimension || '-'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.primary }]}>
            {t('settings.rag_detect_dimension')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
