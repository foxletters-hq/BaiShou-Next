import React from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { AgentGateQuestion } from '@baishou/shared'
import { Button } from '../Button'
import { useNativeTheme } from '../theme'
import type { useCompanionAskDrafts } from '../../agent-gate/use-companion-ask-drafts'

export function CompanionAskFields({
  questions,
  isReplying,
  drafts
}: {
  questions: AgentGateQuestion[]
  isReplying: boolean
  drafts: ReturnType<typeof useCompanionAskDrafts>
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <View style={{ gap: 12 }}>
      {questions.map((question) => {
        const selected = drafts.selectedById[question.id]
        const customOpen = drafts.customOpenId === question.id
        return (
          <View key={question.id} style={{ gap: 8 }}>
            {questions.length > 1 ? (
              <Text style={{ color: colors.textPrimary, fontSize: 14, lineHeight: 22 }}>
                {question.question}
              </Text>
            ) : null}
            {question.options.map((option) => {
              const isSelected = selected === option.id
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => drafts.selectOption(question.id, option.id)}
                  style={{
                    borderWidth: 1,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderColor: isSelected ? colors.primary : colors.borderControl,
                    backgroundColor: isSelected ? colors.primaryLight : 'transparent'
                  }}
                >
                  <Text style={{ color: colors.textPrimary }}>{option.label}</Text>
                </Pressable>
              )
            })}
            {question.allowCustomInput ? (
              customOpen ? (
                <TextInput
                  value={drafts.customById[question.id] ?? ''}
                  onChangeText={(value) => drafts.setCustomMessage(question.id, value)}
                  multiline
                  editable={!isReplying}
                  placeholder={t('agent_gate.custom_answer_placeholder', '输入你的回答或说明…')}
                  placeholderTextColor={colors.textTertiary}
                  style={{
                    minHeight: 72,
                    borderWidth: 1,
                    borderRadius: 10,
                    padding: 10,
                    color: colors.textPrimary,
                    borderColor: colors.borderControl,
                    backgroundColor: colors.bgSurface
                  }}
                />
              ) : (
                <Button
                  variant="outline"
                  onPress={() => drafts.setCustomOpenId(question.id)}
                  disabled={isReplying}
                >
                  {t('agent_gate.custom_answer', '自定义回答')}
                </Button>
              )
            ) : null}
          </View>
        )
      })}
    </View>
  )
}