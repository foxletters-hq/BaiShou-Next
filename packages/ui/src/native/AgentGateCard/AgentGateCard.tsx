import React, { useCallback, useEffect, useState } from 'react'
import { Modal, View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { AgentGateKind, AgentGateReply, type AgentGateRequest } from '@baishou/shared'
import { Button } from '../Button'
import { useNativeTheme } from '../theme'
import {
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
  const allowCustomInput = shouldShowCustomRejectInput(request)
  const showActionMeta = request.kind === AgentGateKind.Tool

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => void handleReply({ requestId: request.id, reply: AgentGateReply.Reject })}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => void handleReply({ requestId: request.id, reply: AgentGateReply.Reject })}
          accessibilityRole="button"
          accessibilityLabel={t('agent_gate.reject', '拒绝')}
        />

        <View
          style={[
            styles.card,
            { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle }
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
                          backgroundColor: selected ? 'rgba(91, 168, 245, 0.12)' : 'transparent'
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
                placeholder={t('agent_gate.custom_answer_placeholder', '输入你的回答或说明…')}
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
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 24
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    zIndex: 2,
    maxHeight: '78%'
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
