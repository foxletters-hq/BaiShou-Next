import React, { useCallback, useEffect, useState } from 'react'
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  useWindowDimensions
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import {
  AgentGateReply,
  buildCompanionAskQuestionAnswers,
  listAgentGateFileChangePreviews,
  resolveCompanionAskQuestions,
  type AgentGateRequest
} from '@baishou/shared'
import { Button } from '../Button'
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
import {
  formatFileChangeKindLabel,
  formatGateQueueLabel
} from '../../agent-gate/agent-gate-preview-copy'

export interface AgentGateCardProps {
  request: AgentGateRequest | null
  isReplying?: boolean
  onReply: (input: AgentGateReplyPayload) => void | Promise<void>
  queueIndex?: number
  queueTotal?: number
  sameActionCount?: number
}

export const AgentGateCard: React.FC<AgentGateCardProps> = ({
  request,
  isReplying = false,
  onReply,
  queueIndex = 0,
  queueTotal = 0
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({})
  const askQuestions = request ? resolveCompanionAskQuestions(request) : []
  const askDrafts = useCompanionAskDrafts(askQuestions)

  useEffect(() => {
    setShowFeedback(false)
    setFeedback('')
    setExpandedDiffs({})
  }, [request?.id])

  const handleReply = useCallback(
    async (payload: AgentGateReplyPayload) => {
      if (!request || isReplying) return
      await onReply(payload)
    },
    [isReplying, onReply, request]
  )

  if (!request) return null

  const proactiveOptions = shouldShowProactiveOptions(request)
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
  const scrollMaxHeight = Math.min(height * 0.62, anyDiffExpanded ? 520 : 360)

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (showFeedback) {
          setShowFeedback(false)
          return
        }
        // Android 返回键：仅退出子步骤，不隐式 Reject
      }}
    >
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: colors.bgOverlay,
            paddingBottom: 16 + insets.bottom
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
          <ScrollView style={{ maxHeight: scrollMaxHeight }} contentContainerStyle={styles.header}>
            <View style={styles.headerRow}>
              <Text
                accessibilityRole="header"
                style={[
                  styles.badge,
                  { color: colors.warning, backgroundColor: 'rgba(245, 158, 11, 0.12)' }
                ]}
              >
                {t('agent_gate.pending_badge', '待确认')}
              </Text>
              {queueLabel ? (
                <Text style={[styles.queueLabel, { color: colors.textTertiary }]}>
                  {queueLabel}
                </Text>
              ) : null}
            </View>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
              {askQuestions.length > 1
                ? t('agent_gate.multi_ask_desc', '请一并确认以下几项。')
                : request.title}
            </Text>
            {coalescedHint ? (
              <Text style={[styles.hint, { color: colors.textSecondary }]}>{coalescedHint}</Text>
            ) : null}
            {!preview && request.description && !descriptionIsOptionsDump ? (
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {request.description}
              </Text>
            ) : null}
            {filePreviews.map((filePreview) => {
              const expanded = Boolean(expandedDiffs[filePreview.path])
              return (
                <View
                  key={`${filePreview.kind}:${filePreview.path}:${filePreview.previousPath ?? ''}`}
                  style={[
                    styles.previewBlock,
                    { borderColor: colors.borderMuted, backgroundColor: colors.bgApp }
                  ]}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {formatFileChangeKindLabel(filePreview.kind)} · {filePreview.path}
                    {filePreview.previousPath ? ` ← ${filePreview.previousPath}` : ''}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {filePreview.additions > 0 ? (
                      <Text style={{ color: '#15803d', fontWeight: '600' }}>
                        +{filePreview.additions}
                      </Text>
                    ) : null}
                    {filePreview.additions > 0 && filePreview.deletions > 0 ? '  ' : null}
                    {filePreview.deletions > 0 ? (
                      <Text style={{ color: '#b91c1c', fontWeight: '600' }}>
                        -{filePreview.deletions}
                      </Text>
                    ) : null}
                    {filePreview.truncated
                      ? `  ${t('agent_gate.diff_truncated', '预览已截断')}`
                      : ''}
                  </Text>
                  {filePreview.diff ? (
                    <>
                      <Pressable
                        onPress={() =>
                          setExpandedDiffs((current) => ({
                            ...current,
                            [filePreview.path]: !current[filePreview.path]
                          }))
                        }
                      >
                        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
                          {expanded
                            ? t('agent_gate.collapse_diff', '收起 Diff')
                            : t('agent_gate.expand_diff', '展开 Diff')}
                        </Text>
                      </Pressable>
                      {expanded ? (
                        <ScrollView style={styles.diffScroll} nestedScrollEnabled>
                          <Text style={[styles.diffText, { color: colors.textPrimary }]}>
                            {filePreview.diff}
                          </Text>
                        </ScrollView>
                      ) : null}
                    </>
                  ) : null}
                </View>
              )
            })}

            {preview?.type === 'command' ? (
              <View
                style={[
                  styles.previewBlock,
                  { borderColor: colors.borderMuted, backgroundColor: colors.bgApp }
                ]}
              >
                <Text style={[styles.commandText, { color: colors.textPrimary }]}>
                  {preview.command}
                </Text>
                {preview.dangerReason ? (
                  <Text style={[styles.hint, { color: colors.warning }]}>
                    {preview.dangerReason}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {preview?.type === 'content' ? (
              <View
                style={[
                  styles.previewBlock,
                  { borderColor: colors.borderMuted, backgroundColor: colors.bgApp }
                ]}
              >
                {preview.subject && preview.subject !== request.title ? (
                  <Text style={{ color: colors.textPrimary }}>{preview.subject}</Text>
                ) : null}
                {preview.summary &&
                !preview.detailLines?.some(
                  (line) => line.includes(preview.summary!) || line.endsWith(preview.summary!)
                ) ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                    {preview.summary}
                  </Text>
                ) : null}
                {preview.detailLines?.map((line) => (
                  <Text key={line} style={{ color: colors.textTertiary, fontSize: 12 }}>
                    {line}
                  </Text>
                ))}
              </View>
            ) : null}

            {proactiveOptions && !showFeedback ? (
              <CompanionAskFields
                questions={askQuestions}
                isReplying={isReplying}
                drafts={askDrafts}
              />
            ) : null}

            {showFeedback ? (
              <TextInput
                value={feedback}
                onChangeText={setFeedback}
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

          <View style={[styles.actions, { borderTopColor: colors.borderMuted }]}>
            {showFeedback ? (
              <>
                <Button
                  variant="outline"
                  onPress={() => {
                    setShowFeedback(false)
                    setFeedback('')
                  }}
                  disabled={isReplying}
                  style={styles.actionButton}
                >
                  {t('common.cancel', '取消')}
                </Button>
                <Button
                  variant="primary"
                  onPress={() =>
                    void handleReply({
                      requestId: request.id,
                      reply: AgentGateReply.Reject,
                      message: feedback.trim() || undefined
                    })
                  }
                  disabled={isReplying}
                  style={styles.actionButton}
                >
                  {proactiveOptions
                    ? t('agent_gate.submit_answer', '提交回答')
                    : t('agent_gate.reject', '拒绝')}
                </Button>
              </>
            ) : proactiveOptions ? (
              <>
                <Button
                  variant="outline"
                  destructive
                  onPress={() =>
                    void handleReply({ requestId: request.id, reply: AgentGateReply.Reject })
                  }
                  disabled={isReplying}
                  style={styles.actionButton}
                  accessibilityLabel={t('agent_gate.reject', '拒绝')}
                >
                  {t('agent_gate.reject', '拒绝')}
                </Button>
                <Button
                  variant="primary"
                  onPress={() => {
                    const questionAnswers = buildCompanionAskQuestionAnswers(
                      askQuestions,
                      askDrafts.drafts
                    )
                    const first = questionAnswers[0]
                    void handleReply({
                      requestId: request.id,
                      reply: AgentGateReply.Once,
                      selectedOptionIds: first?.selectedOptionIds,
                      message: first?.message,
                      questionAnswers
                    })
                  }}
                  disabled={isReplying || !askDrafts.complete}
                  style={styles.actionButton}
                >
                  {t('agent_gate.confirm', '确认')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  destructive
                  onPress={() =>
                    allowCustomInput
                      ? setShowFeedback(true)
                      : void handleReply({ requestId: request.id, reply: AgentGateReply.Reject })
                  }
                  disabled={isReplying}
                  style={styles.actionButton}
                  accessibilityLabel={t('agent_gate.reject', '拒绝')}
                >
                  {t('agent_gate.reject', '拒绝')}
                </Button>
                {showAlways ? (
                  <Button
                    variant="outline"
                    onPress={() =>
                      void handleReply({ requestId: request.id, reply: AgentGateReply.Always })
                    }
                    disabled={isReplying}
                    style={styles.actionButton}
                    accessibilityLabel={t('agent_gate.always', '始终允许')}
                  >
                    {t('agent_gate.always', '始终允许')}
                  </Button>
                ) : null}
                <Button
                  variant="primary"
                  onPress={() =>
                    void handleReply({ requestId: request.id, reply: AgentGateReply.Once })
                  }
                  disabled={isReplying}
                  style={styles.actionButton}
                  accessibilityLabel={t('agent_gate.once', '本次允许')}
                >
                  {t('agent_gate.once', '本次允许')}
                </Button>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    zIndex: 2,
    maxHeight: '86%',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 8
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  badge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden'
  },
  queueLabel: {
    fontSize: 12
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24
  },
  description: {
    fontSize: 14,
    lineHeight: 21
  },
  hint: {
    fontSize: 12,
    lineHeight: 18
  },
  actionMeta: {
    fontSize: 12
  },
  previewBlock: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6
  },
  diffScroll: {
    maxHeight: 220
  },
  diffText: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16
  },
  commandText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18
  },
  option: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  feedbackInput: {
    minHeight: 88,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top'
  },
  actions: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8
  },
  actionButton: {
    width: '100%',
    alignSelf: 'stretch'
  }
})
