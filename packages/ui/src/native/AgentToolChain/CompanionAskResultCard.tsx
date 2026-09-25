import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type {
  CompanionAskOptionView,
  CompanionAskPresentation
} from '../../shared/tool-result.util'
import { useNativeTheme } from '../theme'

function CompanionAskResultItem({
  question,
  answer,
  declined,
  options,
  selectedOptionIds
}: {
  question: string
  answer: string | null
  declined: boolean
  options: CompanionAskOptionView[]
  selectedOptionIds: string[]
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const selected = new Set(selectedOptionIds)
  const showOptions = !declined && options.length > 0

  return (
    <View style={styles.questionBlock}>
      {question ? (
        <Text style={[styles.question, { color: colors.textPrimary }]}>{question}</Text>
      ) : null}
      {declined ? (
        <Text style={[styles.status, { color: colors.textTertiary }]}>
          {t('agent.tools.companion_ask_declined', '没有作答')}
        </Text>
      ) : null}
      {showOptions
        ? options.map((option) => {
            const isSelected = selected.has(option.id) || option.label === answer
            return (
              <View
                key={option.id}
                style={[
                  styles.option,
                  {
                    borderColor: isSelected
                      ? (colors.borderStrong ?? colors.primary)
                      : colors.borderSubtle,
                    backgroundColor: isSelected
                      ? (colors.bgSurfaceHigh ?? colors.bgSurface)
                      : 'transparent'
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
      {!declined && !showOptions && answer ? (
        <View
          style={[
            styles.option,
            {
              borderColor: colors.borderStrong ?? colors.primary,
              backgroundColor: colors.bgSurfaceHigh ?? colors.bgSurface
            }
          ]}
        >
          <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>{answer}</Text>
        </View>
      ) : null}
    </View>
  )
}

export function CompanionAskResultCard({ data }: { data: CompanionAskPresentation }) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const items = data.items && data.items.length > 1 ? data.items : null

  return (
    <View
      style={[styles.card, { borderColor: colors.borderSubtle, backgroundColor: colors.bgSurface }]}
      accessibilityLabel={t('agent.tools.companion_ask', '伙伴提问')}
    >
      <Text style={[styles.label, { color: colors.textTertiary }]}>
        {t('agent.tools.companion_ask_card_label', '提问')}
      </Text>
      {items
        ? items.map((item, index) => (
            <CompanionAskResultItem
              key={`${item.question}-${index}`}
              question={item.question}
              answer={item.answer}
              declined={data.declined}
              options={item.options}
              selectedOptionIds={item.selectedOptionIds}
            />
          ))
        : (
            <CompanionAskResultItem
              question={data.question}
              answer={data.answer}
              declined={data.declined}
              options={data.options}
              selectedOptionIds={data.selectedOptionIds}
            />
          )}
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
  questionBlock: {
    gap: 8
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
