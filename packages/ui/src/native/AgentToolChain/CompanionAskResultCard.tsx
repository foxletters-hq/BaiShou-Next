import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type {
  CompanionAskItemView,
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

function PagedCompanionAskResults({
  items,
  declined
}: {
  items: CompanionAskItemView[]
  declined: boolean
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [index, setIndex] = useState(0)
  const safeIndex = Math.min(index, Math.max(items.length - 1, 0))
  const item = items[safeIndex]
  if (!item) return null

  return (
    <View style={{ gap: 8 }}>
      <CompanionAskResultItem
        question={item.question}
        answer={item.answer}
        declined={declined}
        options={item.options}
        selectedOptionIds={item.selectedOptionIds}
      />
      <View style={styles.pager}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('agent_gate.queue_prev', '上一题')}
          disabled={safeIndex <= 0}
          onPress={() => setIndex((current) => Math.max(0, current - 1))}
          style={[styles.pagerBtn, { borderColor: colors.borderSubtle }]}
        >
          <Text style={{ color: colors.textSecondary }}>{'<'}</Text>
        </Pressable>
        <Text style={[styles.pagerProgress, { color: colors.textTertiary }]}>
          {t('agent_gate.ask_progress', '{{current}} / {{total}}', {
            current: safeIndex + 1,
            total: items.length
          })}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('agent_gate.queue_next', '下一题')}
          disabled={safeIndex >= items.length - 1}
          onPress={() => setIndex((current) => Math.min(items.length - 1, current + 1))}
          style={[styles.pagerBtn, { borderColor: colors.borderSubtle }]}
        >
          <Text style={{ color: colors.textSecondary }}>{'>'}</Text>
        </Pressable>
      </View>
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
      {items ? (
        <PagedCompanionAskResults items={items} declined={data.declined} />
      ) : (
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
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4
  },
  pagerProgress: {
    minWidth: 48,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center'
  },
  pagerBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8
  }
})
