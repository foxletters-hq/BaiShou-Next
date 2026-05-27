import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Switch } from '../Switch'
import { SettingsSection } from '../SettingsSection'
import type { RagConfig, RagStats } from './rag-memory.types'
import { ragMemoryStyles as styles } from './rag-memory.styles'

interface RagMemoryOverviewSectionProps {
  config: RagConfig
  stats: RagStats
  hasMismatchModel: boolean
  embeddingModelId?: string
  onChange: (config: RagConfig) => void
}

export const RagMemoryOverviewSection: React.FC<RagMemoryOverviewSectionProps> = ({
  config,
  stats,
  hasMismatchModel,
  embeddingModelId,
  onChange
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <SettingsSection title={t('rag.title', 'RAG 长期记忆')}>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
            {t('rag.enable', '启用 RAG')}
          </Text>
          <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
            {t('rag.enable_desc', '基于向量检索的长期记忆系统')}
          </Text>
        </View>
        <Switch
          value={config.ragEnabled}
          onValueChange={(v) => onChange({ ...config, ragEnabled: v })}
        />
      </View>

      <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

      <View style={styles.statsRow}>
        <View style={[styles.statChip, { backgroundColor: colors.bgSurfaceNormal }]}>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.totalCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
            {t('rag.total', '总条目')}
          </Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: colors.bgSurfaceNormal }]}>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            {embeddingModelId ?? '-'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
            {t('rag.model', '模型')}
          </Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: colors.bgSurfaceNormal }]}>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            {stats.currentDimension}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
            {t('rag.dim', '维度')}
          </Text>
        </View>
      </View>

      {hasMismatchModel && (
        <View style={[styles.warningBox, { backgroundColor: colors.errorContainer }]}>
          <Text style={[styles.warningText, { color: colors.error }]}>
            {t('rag.mismatch_warning', '模型维度不匹配，请清除旧向量后重新嵌入')}
          </Text>
        </View>
      )}
    </SettingsSection>
  )
}
