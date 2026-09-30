import React, { useEffect, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { companionAskQuestionAnswered, type AgentGateQuestion } from '@baishou/shared'
import { Button } from '../Button'
import { useNativeTheme } from '../theme'
import type { useCompanionAskDrafts } from '../../agent-gate/use-companion-ask-drafts'
import { agentGateCardStyles as cardStyles } from './agent-gate-card.styles'

function optionMark(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1)
}

export function CompanionAskFields({
  questions,
  isReplying,
  drafts,
  onSkip,
  onSubmit,
  part = 'all',
  pageIndex,
  onPageIndexChange,
  onCustomFocus
}: {
  questions: AgentGateQuestion[]
  isReplying: boolean
  drafts: ReturnType<typeof useCompanionAskDrafts>
  onSkip?: () => void
  onSubmit?: () => void
  /** body 只渲染选项，footer 只渲染翻页，避免翻页被卷进滚动区 */
  part?: 'all' | 'body' | 'footer'
  pageIndex?: number
  onPageIndexChange?: (index: number) => void
  onCustomFocus?: () => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const paged = questions.length > 1
  const [internalIndex, setInternalIndex] = useState(0)
  const questionKey = questions.map((item) => item.id).join(':')
  const index = pageIndex ?? internalIndex

  useEffect(() => {
    if (pageIndex != null) return
    setInternalIndex(0)
  }, [pageIndex, questionKey])

  const setIndex = (next: number) => {
    if (pageIndex == null) setInternalIndex(next)
    onPageIndexChange?.(next)
  }

  const safeIndex = Math.min(index, Math.max(questions.length - 1, 0))
  const visible = paged ? questions.slice(safeIndex, safeIndex + 1) : questions
  const onLast = safeIndex >= questions.length - 1
  const currentQuestion = questions[safeIndex]
  const currentAnswered = Boolean(
    currentQuestion &&
    companionAskQuestionAnswered(
      currentQuestion,
      drafts.drafts.find((item) => item.questionId === currentQuestion.id)
    )
  )
  const canAdvance = onLast ? drafts.complete : currentAnswered
  const pagerDisabledPrev = safeIndex <= 0 || isReplying
  const pagerDisabledNext = onLast || isReplying
  const footer =
    paged && onSkip && onSubmit ? (
      <View style={{ gap: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          <Pressable
            disabled={pagerDisabledPrev}
            onPress={() => setIndex(Math.max(0, safeIndex - 1))}
            accessibilityRole="button"
            accessibilityLabel={t('agent_gate.queue_prev', '上一题')}
            style={[
              cardStyles.queueNavBtn,
              {
                borderColor: colors.borderControl,
                backgroundColor: colors.bgSurface,
                opacity: pagerDisabledPrev ? 0.4 : 1
              }
            ]}
          >
            <ChevronLeft size={16} color={colors.textSecondary} strokeWidth={2} />
          </Pressable>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {t('agent_gate.ask_progress', '{{current}} / {{total}}', {
              current: safeIndex + 1,
              total: questions.length
            })}
          </Text>
          <Pressable
            disabled={pagerDisabledNext}
            onPress={() => setIndex(Math.min(questions.length - 1, safeIndex + 1))}
            accessibilityRole="button"
            accessibilityLabel={t('agent_gate.queue_next', '下一题')}
            style={[
              cardStyles.queueNavBtn,
              {
                borderColor: colors.borderControl,
                backgroundColor: colors.bgSurface,
                opacity: pagerDisabledNext ? 0.4 : 1
              }
            ]}
          >
            <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Button variant="outline" disabled={isReplying} onPress={onSkip} style={pagerButtonStyle}>
            {t('agent_gate.ask_skip', '跳过')}
          </Button>
          <Button
            variant="outline"
            disabled={isReplying || !canAdvance}
            onPress={() => {
              if (!onLast) {
                setIndex(Math.min(questions.length - 1, safeIndex + 1))
                return
              }
              onSubmit()
            }}
            style={pagerButtonStyle}
          >
            {onLast ? t('agent_gate.confirm', '确认') : t('agent_gate.ask_next', '下一题')}
          </Button>
        </View>
      </View>
    ) : null

  if (part === 'footer') return footer

  return (
    <View style={{ gap: 12 }}>
      {visible.map((question) => {
        const selected = drafts.selectedById[question.id]
        const customOpen = drafts.customOpenId === question.id
        return (
          <View key={question.id} style={{ gap: 8 }}>
            {paged ? (
              <Text style={{ color: colors.textPrimary, fontSize: 14, lineHeight: 22 }}>
                {question.question}
              </Text>
            ) : null}
            {question.options.map((option, optionIndex) => {
              const isSelected = selected === option.id
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => drafts.selectOption(question.id, option.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 10,
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 6,
                    backgroundColor: isSelected ? colors.bgSurfaceHigh : 'transparent'
                  }}
                >
                  <Text
                    style={{
                      width: 22,
                      height: 22,
                      textAlign: 'center',
                      lineHeight: 20,
                      borderWidth: 1,
                      borderRadius: 6,
                      overflow: 'hidden',
                      borderColor: isSelected ? colors.borderStrong : colors.borderControl,
                      color: colors.textSecondary,
                      backgroundColor: colors.bgSurface
                    }}
                  >
                    {optionMark(optionIndex)}
                  </Text>
                  <Text style={{ flex: 1, color: colors.textPrimary }}>{option.label}</Text>
                </Pressable>
              )
            })}
            {question.allowCustomInput ? (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: customOpen }}
                disabled={isReplying}
                onPress={() => {
                  drafts.openCustom(question.id)
                  onCustomFocus?.()
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                  backgroundColor: customOpen ? colors.bgSurfaceHigh : 'transparent'
                }}
              >
                <Text
                  style={{
                    width: 22,
                    height: 22,
                    textAlign: 'center',
                    lineHeight: 20,
                    borderWidth: 1,
                    borderRadius: 6,
                    overflow: 'hidden',
                    borderColor: customOpen ? colors.borderStrong : colors.borderControl,
                    color: colors.textSecondary,
                    backgroundColor: colors.bgSurface
                  }}
                >
                  {optionMark(question.options.length)}
                </Text>
                <Text style={{ flex: 1, color: colors.textPrimary }}>
                  {t('agent_gate.custom_answer', '自定义回答')}
                </Text>
              </Pressable>
            ) : null}
            {question.allowCustomInput && customOpen ? (
              <TextInput
                value={drafts.customById[question.id] ?? ''}
                onChangeText={(value) => drafts.setCustomMessage(question.id, value)}
                onFocus={onCustomFocus}
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
                  backgroundColor: colors.bgSurface,
                  textAlignVertical: 'top'
                }}
              />
            ) : null}
          </View>
        )
      })}
      {part === 'all' ? footer : null}
    </View>
  )
}

const pagerButtonStyle = { flex: 1, minHeight: 40, paddingHorizontal: 10 }
