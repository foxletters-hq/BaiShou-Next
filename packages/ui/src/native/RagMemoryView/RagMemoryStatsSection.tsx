import React from 'react'
import { View, Text, TouchableOpacity, Platform } from 'react-native'
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons'
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
  const useMaterialIcons = Platform.OS === 'android'
  const StatIcon = useMaterialIcons ? MaterialIcons : MaterialCommunityIcons
  type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name']
  type CommunityIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name']
  const statIcons = useMaterialIcons
    ? ({
        count: 'sd-storage',
        model: 'hub',
        dimension: 'call-merge',
        refresh: 'refresh'
      } satisfies Record<string, MaterialIconName>)
    : ({
        count: 'database-outline',
        model: 'hub',
        dimension: 'vector-combine',
        refresh: 'refresh'
      } satisfies Record<string, CommunityIconName>)

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
        <StatIcon name={statIcons.count as never} size={14} color={colors.primary} />
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
        <StatIcon name={statIcons.model as never} size={14} color={colors.success} />
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
        <StatIcon name={statIcons.dimension as never} size={14} color={colors.textSecondary} />
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
        <StatIcon name={statIcons.refresh as never} size={14} color={colors.primary} />
        <Text style={[styles.statValue, { color: colors.primary, fontSize: 12 }]} numberOfLines={2}>
          {t('settings.rag_detect_dimension')}
        </Text>
      </TouchableOpacity>
    </View>
  )
}
