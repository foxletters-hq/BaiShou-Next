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
import { AgentGateKind, AgentGateReply, type AgentGateRequest } from '@baishou/shared'
import { Button } from '../Button'
import { useNativeTheme } from '../theme'
import {
  resolveAlwaysAllowPrefixHint,
  resolveAlwaysDisabledReason,
  shouldShowAlwaysAllow,
  shouldShowCustomRejectInput,
  shouldShowProactiveOptions,
  type AgentGateReplyPayload
} from '../../agent-gate'
import {
  formatFileChangeKindLabel,
  formatGateQueueLabel,
  humanizeRepeatHint,
  resolveScopeLabel
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
  queueTotal = 0,
  sameActionCount = 0
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [diffExpanded, setDiffExpanded] = useState(false)
  const [alwaysConfirm, setAlwaysConfirm] = useState(false)
  const [techOpen, setTechOpen] = useState(false)

  useEffect(() => {
    setShowFeedback(false)
    setFeedback('')
    setSelectedOptionId(null)
    setDiffExpanded(false)
    setAlwaysConfirm(false)
    setTechOpen(false)
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
  const alwaysDisabledReason = resolveAlwaysDisabledReason(request)
  const alwaysPrefixHint = resolveAlwaysAllowPrefixHint(request)
  const allowCustomInput = shouldShowCustomRejectInput(request)
  const showActionMeta = request.kind === AgentGateKind.Tool
  const queueLabel = formatGateQueueLabel(queueIndex, queueTotal)
  const repeatHint = humanizeRepeatHint(request)
  const scopeLabel = resolveScopeLabel(request)
  const preview = request.preview
  const cascadeHint =
    sameActionCount > 1
      ? t(
          'agent_gate.cascade_hint',
          '此决定将影响本会话中另外 {{count}} 个相同操作',
          { count: sameActionCount - 1 }
        )
      : null
  const scrollMaxHeight = Math.min(height * 0.62, diffExpanded ? 520 : 360)

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (alwaysConfirm) {
          setAlwaysConfirm(false)
          return
        }
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
              borderColor: colors.borderSubtle,
              shadowColor: colors.textPrimary
            }
          ]}
          pointerEvents="box-none"
          accessibilityRole="summary"
        >
          <ScrollView
            style={{ maxHeight: scrollMaxHeight }}
            contentContainerStyle={styles.header}
          >
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
                <Text style={[styles.queueLabel, { color: colors.textTertiary }]}>{queueLabel}</Text>
              ) : null}
            </View>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: colors.textPrimary }]}
            >
              {request.title}
            </Text>
            {request.description ? (
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {request.description}
              </Text>
            ) : null}
            {repeatHint ? (
              <Text style={[styles.hint, { color: colors.textSecondary }]}>{repeatHint}</Text>
            ) : null}
            {cascadeHint ? (
              <Text style={[styles.hint, { color: colors.textSecondary }]}>{cascadeHint}</Text>
            ) : null}

            {preview?.type === 'file_change' ? (
              <View
                style={[
                  styles.previewBlock,
                  { borderColor: colors.borderSubtle, backgroundColor: colors.bgApp }
                ]}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {formatFileChangeKindLabel(preview.kind)} · {preview.path}
                  {preview.previousPath ? ` ← ${preview.previousPath}` : ''}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  <Text style={{ color: '#15803d', fontWeight: '600' }}>+{preview.additions}</Text>
                  {'  '}
                  <Text style={{ color: '#b91c1c', fontWeight: '600' }}>-{preview.deletions}</Text>
                  {preview.truncated ? `  ${t('agent_gate.diff_truncated', '预览已截断')}` : ''}
                </Text>
                {preview.diff ? (
                  <>
                    <Pressable onPress={() => setDiffExpanded((v) => !v)}>
                      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
                        {diffExpanded
                          ? t('agent_gate.collapse_diff', '收起 Diff')
                          : t('agent_gate.expand_diff', '展开 Diff')}
                      </Text>
                    </Pressable>
                    {diffExpanded ? (
                      <ScrollView style={styles.diffScroll} nestedScrollEnabled>
                        <Text style={[styles.diffText, { color: colors.textPrimary }]}>
                          {preview.diff}
                        </Text>
                      </ScrollView>
                    ) : null}
                  </>
                ) : null}
              </View>
            ) : null}

            {preview?.type === 'command' ? (
              <View
                style={[
                  styles.previewBlock,
                  { borderColor: colors.borderSubtle, backgroundColor: colors.bgApp }
                ]}
              >
                <Text style={[styles.commandText, { color: colors.textPrimary }]}>
                  {preview.command}
                </Text>
                {preview.dangerReason ? (
                  <Text style={[styles.hint, { color: colors.warning }]}>{preview.dangerReason}</Text>
                ) : null}
              </View>
            ) : null}

            {preview?.type === 'content' ? (
              <View
                style={[
                  styles.previewBlock,
                  { borderColor: colors.borderSubtle, backgroundColor: colors.bgApp }
                ]}
              >
                <Text style={{ color: colors.textPrimary }}>{preview.subject}</Text>
                {preview.summary ? (
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

            <Pressable onPress={() => setTechOpen((v) => !v)}>
              <Text style={[styles.actionMeta, { color: colors.textTertiary }]}>
                {techOpen
                  ? t('agent_gate.hide_tech_details', '收起技术详情')
                  : t('agent_gate.tech_details', '技术详情')}
              </Text>
            </Pressable>
            {techOpen ? (
              <>
                {showActionMeta ? (
                  <Text style={[styles.actionMeta, { color: colors.textTertiary }]}>
                    {t('agent_gate.dock_action', '操作：{{action}}', { action: request.action })}
                  </Text>
                ) : null}
                {request.fingerprint ? (
                  <Text style={[styles.actionMeta, { color: colors.textTertiary }]}>
                    {t('agent_gate.fingerprint_meta', '指纹 {{fp}} · 连打 {{count}}', {
                      fp: request.fingerprint.slice(0, 10),
                      count: request.repeatCount ?? 1
                    })}
                  </Text>
                ) : null}
                <Text style={[styles.actionMeta, { color: colors.textTertiary }]}>{scopeLabel}</Text>
              </>
            ) : null}

            {alwaysConfirm ? (
              <View
                style={[
                  styles.previewBlock,
                  { borderColor: colors.primary, backgroundColor: colors.primaryLight }
                ]}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 13, lineHeight: 20 }}>
                  {t(
                    'agent_gate.always_confirm_body',
                    '始终允许将持久保存到本机（可在设置中撤销），范围：{{scope}}。匹配：{{pattern}}。',
                    {
                      scope: scopeLabel,
                      pattern: alwaysPrefixHint ?? request.action
                    }
                  )}
                </Text>
              </View>
            ) : null}

            {proactiveOptions && !showFeedback
              ? request.options.map((option) => {
                  const selected = selectedOptionId === option.id
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => setSelectedOptionId(option.id)}
                      style={[
                        styles.option,
                        {
                          borderColor: selected ? colors.primary : colors.borderSubtle,
                          backgroundColor: selected ? colors.primaryLight : 'transparent'
                        }
                      ]}
                    >
                      <Text style={{ color: colors.textPrimary }}>{option.label}</Text>
                    </Pressable>
                  )
                })
              : null}

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
                    borderColor: colors.borderSubtle,
                    backgroundColor: colors.bgSurface
                  }
                ]}
              />
            ) : null}
          </ScrollView>

          <View style={[styles.actions, { borderTopColor: colors.borderSubtle }]}>
            {alwaysConfirm ? (
              <>
                <Button
                  variant="outline"
                  onPress={() => setAlwaysConfirm(false)}
                  disabled={isReplying}
                  style={styles.actionButton}
                  accessibilityLabel={t('common.cancel', '取消')}
                >
                  {t('common.cancel', '取消')}
                </Button>
                <Button
                  variant="primary"
                  onPress={() =>
                    void handleReply({ requestId: request.id, reply: AgentGateReply.Always })
                  }
                  disabled={isReplying}
                  style={styles.actionButton}
                  accessibilityLabel={t('agent_gate.always_confirm', '确认始终允许')}
                >
                  {t('agent_gate.always_confirm', '确认始终允许')}
                </Button>
              </>
            ) : showFeedback ? (
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
                {allowCustomInput ? (
                  <Button
                    variant="outline"
                    onPress={() => setShowFeedback(true)}
                    disabled={isReplying}
                    style={styles.actionButton}
                  >
                    {t('agent_gate.custom_answer', '自定义回答')}
                  </Button>
                ) : null}
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
                  onPress={() =>
                    void handleReply({
                      requestId: request.id,
                      reply: AgentGateReply.Once,
                      selectedOptionIds: selectedOptionId ? [selectedOptionId] : undefined
                    })
                  }
                  disabled={isReplying || !selectedOptionId}
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
                    onPress={() => setAlwaysConfirm(true)}
                    disabled={isReplying}
                    style={styles.actionButton}
                    accessibilityLabel={t('agent_gate.always', '始终允许')}
                  >
                    {t('agent_gate.always', '始终允许')}
                  </Button>
                ) : alwaysDisabledReason ? (
                  <Text style={[styles.actionMeta, { color: colors.textSecondary }]}>
                    {alwaysDisabledReason}
                  </Text>
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
