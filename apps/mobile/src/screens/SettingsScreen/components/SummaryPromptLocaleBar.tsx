import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { SUMMARY_PROMPT_LOCALE_OPTIONS, type SummaryPromptLocale } from '@baishou/shared'
import { useNativeTheme } from '@baishou/ui/native'
import { summarySettingsStyles as styles } from './summary-settings.styles'

export function SummaryPromptLocaleBar(props: {
  activePromptLocale: SummaryPromptLocale
  generationLocale: SummaryPromptLocale
  onChange: (locale: SummaryPromptLocale) => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { activePromptLocale, generationLocale, onChange } = props

  return (
    <View style={styles.langBar}>
      {SUMMARY_PROMPT_LOCALE_OPTIONS.map((lang) => (
        <TouchableOpacity
          key={lang.id}
          style={[
            styles.langChip,
            {
              borderColor: activePromptLocale === lang.id ? colors.primary : colors.borderControl,
              backgroundColor: activePromptLocale === lang.id ? colors.primary : 'transparent'
            },
            generationLocale === lang.id && styles.langChipGeneration
          ]}
          onPress={() => onChange(lang.id)}
        >
          <Text
            style={{
              color: activePromptLocale === lang.id ? colors.textOnPrimary : colors.textSecondary,
              fontSize: 13,
              fontWeight: activePromptLocale === lang.id ? '600' : '400'
            }}
          >
            {t(lang.labelKey, lang.fallback)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}
