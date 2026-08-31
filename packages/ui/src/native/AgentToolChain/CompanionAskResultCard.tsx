import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { CompanionAskPresentation } from '../../shared/tool-result.util'
import { useNativeTheme } from '../theme'

export function CompanionAskResultCard({ data }: { data: CompanionAskPresentation }) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const selected = new Set(data.selectedOptionIds)
  const showOptions = !data.declined && data.options.length > 0

  return (
    <View
      style={[
        styles.card,
        { borderColor: colors.borderSubtle, backgroundColor: colors.bgSurface }
      ]}
      accessibilityLabel={t('agent.tools.companion_ask', '伙伴提问')}
    >
      <Text style={[styles.label, { color: colors.textTertiary }]}>
        {t('agent.tools.companion_ask_card_label', '提问')}
      </Text>
      {data.question ? (
        <Text style={[styles.question, { color: colors.textPrimary }]}>{data.question}</Text>
      ) : null}
      {data.declined ? (
        <Text style={[styles.status, { color: colors.textTertiary }]}>
          {t('agent.tools.companion_ask_declined', '没有作答')}
        </Text>
      ) : null}
      {showOptions
        ? data.options.map((option) => {
            const isSelected = selected.has(option.id) || option.label === data.answer
            return (
              <View
                key={option.id}
                style={[
                  styles.option,
                  {
                    borderColor: isSelected
                      ? colors.borderStrong ?? colors.primary
                      : colors.borderSubtle,
                    backgroundColor: isSelected ? colors.bgSurfaceHigh ?? colors.bgSurface : 'transparent'
                  }
                ]}
              >
                <Text
                  style={[
                    styles.optionLabel,
                    { color: isSelected ? colors.textPrimary : colors.textSecondary }
                  ]}
                >
                  {option.label}
                </Text>
              </View>
            )
          })
        : null}
      {!data.declined && !showOptions && data.answer ? (
        <View
          style={[
            styles.option,
            {
              borderColor: colors.borderStrong ?? colors.primary,
              backgroundColor: colors.bgSurfaceHigh ?? colors.bgSurface
            }
          ]}
        >
          <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>{data.answer}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    marginVertical: 4
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500'
  },
  question: {
    fontSize: 14,
    lineHeight: 22
  },
  status: {
    fontSize: 13,
    lineHeight: 20
  },
  option: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  optionLabel: {
    fontSize: 13,
    lineHeight: 20
  }
})
