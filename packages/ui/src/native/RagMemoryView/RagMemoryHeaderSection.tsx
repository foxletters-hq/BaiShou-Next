import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Switch } from '../Switch'
import type { RagConfig, RagStats } from './rag-memory.types'
import { ragMemoryStyles as styles } from './rag-memory.styles'

interface RagMemoryHeaderSectionProps {
  config: RagConfig
  stats: RagStats
  onChange: (config: RagConfig) => void
  onClearAll?: () => Promise<void>
}

export const RagMemoryHeaderSection: React.FC<RagMemoryHeaderSectionProps> = ({
  config,
  stats,
  onChange,
  onClearAll
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  return (
    <View
      style={[
        styles.headerBlock,
        {
          paddingHorizontal: tokens.spacing.lg,
          paddingTop: tokens.spacing.md,
          paddingBottom: tokens.spacing.sm
        }
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('agent.rag.title')}
        </Text>
        <Switch
          value={config.ragEnabled}
          onValueChange={(v) => onChange({ ...config, ragEnabled: v })}
        />
      </View>
      <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
        {t('settings.tooltip_rag_management')}
      </Text>
      {stats.totalCount > 0 && onClearAll ? (
        <TouchableOpacity
          style={[styles.clearAllBtn, { borderColor: colors.borderSubtle }]}
          onPress={() => void onClearAll()}
        >
          <Text style={[styles.clearAllText, { color: colors.error }]}>
            {t('settings.rag_clear_all')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}
