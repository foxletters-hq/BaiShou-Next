import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Switch } from '../Switch'
import { settingsCardStyles } from '../settings/settings-card.styles'
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
  const { colors } = useNativeTheme()

  return (
    <View>
      <View style={settingsCardStyles.row}>
        <View style={settingsCardStyles.rowText}>
          <Text style={[settingsCardStyles.cardTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
            {t('agent.rag.title')}
          </Text>
          <Text style={[settingsCardStyles.hint, { color: colors.textSecondary, marginTop: 6 }]}>
            {t('settings.tooltip_rag_management')}
          </Text>
        </View>
        <Switch
          value={config.ragEnabled}
          onValueChange={(v) => onChange({ ...config, ragEnabled: v })}
        />
      </View>

      {stats.totalCount > 0 && onClearAll ? (
        <TouchableOpacity
          style={[
            styles.clearAllBtn,
            {
              borderColor: colors.errorContainer,
              backgroundColor: colors.errorContainer
            }
          ]}
          onPress={() => void onClearAll()}
          activeOpacity={0.7}
        >
          <Text style={[styles.clearAllText, { color: colors.error }]}>
            {t('settings.rag_clear_all')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}
