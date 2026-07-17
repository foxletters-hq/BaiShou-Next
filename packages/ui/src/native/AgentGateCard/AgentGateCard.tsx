import React, { useCallback, useEffect, useState } from 'react'
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  SafeAreaView
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { AgentGateKind, AgentGateReply, type AgentGateRequest } from '@baishou/shared'
import { Button } from '../Button'
import { useNativeTheme } from '../theme'
import {
  resolveAlwaysAllowPrefixHint,
  shouldShowAlwaysAllow,
  shouldShowCustomRejectInput,
  shouldShowProactiveOptions,
  type AgentGateReplyPayload
} from '../../agent-gate'

export interface AgentGateCardProps {
  request: AgentGateRequest | null
  isReplying?: boolean
  onReply: (input: AgentGateReplyPayload) => void | Promise<void>
}

export const AgentGateCard: React.FC<AgentGateCardProps> = ({
  request,
  isReplying = false,
  onReply
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)

  useEffect(() => {
    setShowFeedback(false)
    setFeedback('')
    setSelectedOptionId(null)
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
  const alwaysPrefixHint = resolveAlwaysAllowPrefixHint(request)
  const allowCustomInput = shouldShowCustomRejectInput(request)
  const showActionMeta = request.kind === AgentGateKind.Tool
  const showWorkspaceRunAlwaysHint = request.action === 'workspace_run'

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => void handleReply({ requestId: request.id, reply: AgentGateReply.Reject })}
    >
      <View style={[styles.overlay, { backgroundColor: colors.bgOverlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => void handleReply({ requestId: request.id, reply: AgentGateReply.Reject })}
          accessibilityRole="button"
          accessibilityLabel={t('agent_gate.reject', '拒绝')}
        />

        <SafeAreaView style={styles.safeBottom} pointerEvents="box-none">
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
        >
          <ScrollView style={styles.scroll} contentContainerStyle={styles.header}>
            <Text
              style={[
                styles.badge,
                { color: colors.warning, backgroundColor: 'rgba(245, 158, 11, 0.12)' }
              ]}
            >
              {t('agent_gate.pending_badge', '待确认')}
            </Text>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{request.title}</Text>
            {request.description ? (
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {request.description}
              </Text>
            ) : null}
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
            {showWorkspaceRunAlwaysHint && !proactiveOptions ? (
              <Text style={[styles.actionMeta, { color: colors.textSecondary }]}>
                {alwaysPrefixHint
                  ? t('agent_gate.always_prefix_hint', '始终允许将写入前缀：{{pattern}}', {
                      pattern: alwaysPrefixHint
                    })
                  : t('agent_gate.always_not_available', '此命令不可始终允许')}
              </Text>
            ) : null}

            {proactiveOptions && !showFeedback
              ? request.options.map((option) => {
                  const selected = selectedOptionId === option.id
                  return (
                    <Pressable
                      key={option.id}
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
                >
                  {t('agent_gate.once', '本次允许')}
                </Button>
              </>
            )}
          </View>
        </View>
        </SafeAreaView>
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
  safeBottom: {
    width: '100%'
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    zIndex: 2,
    maxHeight: '78%',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8
  },
  scroll: {
    maxHeight: 360
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 8
  },
  badge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden'
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24
  },
  description: {
    fontSize: 14,
    lineHeight: 21
  },
  actionMeta: {
    fontSize: 12
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
