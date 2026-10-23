import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Keyboard,
  Modal,
  Platform,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  useWindowDimensions
} from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import {
  AgentGateReply,
  buildCompanionAskQuestionAnswers,
  listAgentGateFileChangePreviews,
  resolveCompanionAskQuestions,
  type AgentGateRequest
} from '@baishou/shared'
import { useNativeTheme } from '../theme'
import {
  formatCoalescedToolHint,
  shouldShowAlwaysAllow,
  shouldShowCustomRejectInput,
  shouldShowProactiveOptions,
  type AgentGateReplyPayload
} from '../../agent-gate'
import { useCompanionAskDrafts } from '../../agent-gate/use-companion-ask-drafts'
import { CompanionAskFields } from './CompanionAskFields'
import { AgentGateCardActions } from './AgentGateCardActions'
import { AgentGatePreviewBlocks } from './AgentGatePreviewBlocks'
import { agentGateCardStyles as styles } from './agent-gate-card.styles'
import { canFlipGateQueue, formatGateQueueLabel } from '../../agent-gate/agent-gate-preview-copy'

export interface AgentGateCardProps {
  request: AgentGateRequest | null
  isReplying?: boolean
  onReply: (input: AgentGateReplyPayload) => void | Promise<void>
  queueIndex?: number
  queueTotal?: number
  sameActionCount?: number
  onQueuePrev?: () => void
  onQueueNext?: () => void
}

export const AgentGateCard: React.FC<AgentGateCardProps> = ({
  request,
  isReplying = false,
  onReply,
  queueIndex = 0,
  queueTotal = 0,
  onQueuePrev,
  onQueueNext
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({})
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [askPage, setAskPage] = useState(0)
  const scrollRef = useRef<ScrollView>(null)
  const askQuestions = useMemo(
    () => (request ? resolveCompanionAskQuestions(request) : []),
    [request]
  )
  const askQuestionKey = askQuestions.map((item) => item.id).join(':')
  const askDrafts = useCompanionAskDrafts(askQuestions)

  useEffect(() => {
    setShowFeedback(false)
    setFeedback('')
    setExpandedDiffs({})
    setAskPage(0)
  }, [request?.id])

  useEffect(() => {
    setAskPage(0)
  }, [askQuestionKey])

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates?.height ?? 0)
    })
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0))
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  const revealCustomAnswer = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true })
    })
  }, [])

  const handleReply = useCallback(
    async (payload: AgentGateReplyPayload) => {
      if (!request || isReplying) return
      await onReply(payload)
    },
    [isReplying, onReply, request]
  )

  const submitAsk = useCallback(() => {
    if (!request) return
    const questionAnswers = buildCompanionAskQuestionAnswers(askQuestions, askDrafts.drafts)
    const first = questionAnswers[0]
    void handleReply({
      requestId: request.id,
      reply: AgentGateReply.Once,
      selectedOptionIds: first?.selectedOptionIds,
      message: first?.message,
      questionAnswers
    })
  }, [askDrafts.drafts, askQuestions, handleReply, request])

  if (!request) return null

  const proactiveOptions = shouldShowProactiveOptions(request)
  const pagedAsk = proactiveOptions && askQuestions.length > 1
  const showAlways = shouldShowAlwaysAllow(request)
  const allowCustomInput = shouldShowCustomRejectInput(request)
  const queueLabel = formatGateQueueLabel(queueIndex, queueTotal)
  const preview = request.preview
  const filePreviews = listAgentGateFileChangePreviews(request)
  const coalescedHint = formatCoalescedToolHint(request, t)
  const anyDiffExpanded = filePreviews.some((item) => expandedDiffs[item.path])
  const numberedOptionsText =
    proactiveOptions && request.options.length > 0
      ? request.options.map((option, index) => `${index + 1}. ${option.label}`).join('\n')
      : null
  const descriptionIsOptionsDump =
    Boolean(request.description) && request.description?.trim() === numberedOptionsText
  const scrollMaxHeight = Math.min(
    height * (keyboardHeight > 0 ? 0.34 : 0.62),
    keyboardHeight > 0 ? 220 : anyDiffExpanded ? 520 : 360
  )
  const questionPrompt =
    !pagedAsk && request.title.trim() && request.title.trim() !== request.description?.trim()
      ? request.title.trim()
      : null
  const canQueuePrev = canFlipGateQueue(queueIndex, queueTotal, -1) && !isReplying
  const canQueueNext = canFlipGateQueue(queueIndex, queueTotal, 1) && !isReplying

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (showFeedback) {
          setShowFeedback(false)
        }
        // Android 返回键：仅退出子步骤，不隐式 Reject
      }}
    >
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: colors.bgOverlay,
            paddingBottom:
              keyboardHeight > 0
                ? keyboardHeight + tokens.spacing.sm
                : tokens.spacing.xl + tokens.spacing.md + insets.bottom
          }
        ]}
      >
        {/* 遮罩不可决议，仅视觉层 */}
        <Pressable style={StyleSheet.absoluteFill} accessibilityElementsHidden />

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderMuted,
              shadowColor: colors.textPrimary
            }
          ]}
          pointerEvents="box-none"
          accessibilityRole="summary"
        >
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: scrollMaxHeight }}
            contentContainerStyle={styles.header}
          >
            <View style={styles.headerRow}>
              <Text
                accessibilityRole="header"
                style={[styles.title, { color: colors.textPrimary }]}
              >
                {t('agent_gate.dock_title', '需要确认')}
              </Text>
              {queueLabel ? (
                <View style={styles.queueNav}>
                  <Pressable
                    disabled={!canQueuePrev}
                    onPress={onQueuePrev}
                    accessibilityRole="button"
                    accessibilityLabel={t('agent_gate.queue_prev', '上一张')}
                    style={[
                      styles.queueNavBtn,
                      {
                        borderColor: colors.borderControl,
                        backgroundColor: colors.bgSurface,
                        opacity: canQueuePrev ? 1 : 0.4
                      }
                    ]}
                  >
                    <ChevronLeft size={16} color={colors.textSecondary} strokeWidth={2} />
                  </Pressable>
                  <Text style={[styles.queueLabel, { color: colors.textTertiary }]}>
                    {queueLabel}
                  </Text>
                  <Pressable
                    disabled={!canQueueNext}
                    onPress={onQueueNext}
                    accessibilityRole="button"
                    accessibilityLabel={t('agent_gate.queue_next', '下一张')}
                    style={[
                      styles.queueNavBtn,
                      {
                        borderColor: colors.borderControl,
                        backgroundColor: colors.bgSurface,
                        opacity: canQueueNext ? 1 : 0.4
                      }
                    ]}
                  >
                    <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
                  </Pressable>
                </View>
              ) : null}
            </View>
            {questionPrompt ? (
              <Text style={[styles.description, { color: colors.textPrimary }]}>
                {questionPrompt}
              </Text>
            ) : null}
            {coalescedHint ? (
              <Text style={[styles.hint, { color: colors.textSecondary }]}>{coalescedHint}</Text>
            ) : null}
            {!preview && request.description && !descriptionIsOptionsDump ? (
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {request.description}
              </Text>
            ) : null}
            <AgentGatePreviewBlocks
              filePreviews={filePreviews}
              expandedDiffs={expandedDiffs}
              onToggleDiff={(path) =>
                setExpandedDiffs((current) => ({
                  ...current,
                  [path]: !current[path]
                }))
              }
              preview={preview}
              requestTitle={request.title}
            />

            {proactiveOptions && !showFeedback ? (
              <CompanionAskFields
                part="body"
                questions={askQuestions}
                isReplying={isReplying}
                drafts={askDrafts}
                pageIndex={askPage}
                onPageIndexChange={setAskPage}
                onCustomFocus={revealCustomAnswer}
                onSkip={() =>
                  void handleReply({ requestId: request.id, reply: AgentGateReply.Reject })
                }
                onSubmit={submitAsk}
              />
            ) : null}

            {showFeedback ? (
              <TextInput
                value={feedback}
                onChangeText={setFeedback}
                onFocus={revealCustomAnswer}
                multiline
                placeholder={t(
                  proactiveOptions
                    ? 'agent_gate.custom_answer_placeholder'
                    : 'agent_gate.reject_feedback_placeholder',
                  proactiveOptions ? '输入你的回答或说明…' : '告诉伙伴为什么拒绝（可选）…'
                )}
                placeholderTextColor={colors.textTertiary}
                style={[
                  styles.feedbackInput,
                  {
                    color: colors.textPrimary,
                    borderColor: colors.borderControl,
                    backgroundColor: colors.bgSurface
                  }
                ]}
              />
            ) : null}
          </ScrollView>

          <AgentGateCardActions
            requestId={request.id}
            isReplying={isReplying}
            showFeedback={showFeedback}
            feedback={feedback}
            onCancelFeedback={() => {
              setShowFeedback(false)
              setFeedback('')
            }}
            onShowFeedback={() => setShowFeedback(true)}
            proactiveOptions={proactiveOptions}
            pagedAsk={pagedAsk}
            allowCustomInput={allowCustomInput}
            showAlways={showAlways}
            askQuestions={askQuestions}
            askDrafts={askDrafts}
            askPage={askPage}
            onAskPageChange={setAskPage}
            onReply={handleReply}
          />
        </View>
      </View>
    </Modal>
  )
}
