import React from 'react'
import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  AgentGateReply,
  buildCompanionAskQuestionAnswers,
  type AgentGateQuestion
} from '@baishou/shared'
import { Button } from '../Button'
import { useNativeTheme } from '../theme'
import type { useCompanionAskDrafts } from '../../agent-gate/use-companion-ask-drafts'
import type { AgentGateReplyPayload } from '../../agent-gate'
import { CompanionAskFields } from './CompanionAskFields'
import { agentGateCardStyles as styles } from './agent-gate-card.styles'

export function AgentGateCardActions({
  requestId,
  isReplying,
  showFeedback,
  feedback,
  onCancelFeedback,
  onShowFeedback,
  proactiveOptions,
  pagedAsk,
  allowCustomInput,
  showAlways,
  askQuestions,
  askDrafts,
  askPage,
  onAskPageChange,
  onReply
}: {
  requestId: string
  isReplying: boolean
  showFeedback: boolean
  feedback: string
  onCancelFeedback: () => void
  onShowFeedback: () => void
  proactiveOptions: boolean
  pagedAsk: boolean
  allowCustomInput: boolean
  showAlways: boolean
  askQuestions: AgentGateQuestion[]
  askDrafts: ReturnType<typeof useCompanionAskDrafts>
  askPage: number
  onAskPageChange: (index: number) => void
  onReply: (payload: AgentGateReplyPayload) => void | Promise<void>
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const submitAsk = () => {
    const questionAnswers = buildCompanionAskQuestionAnswers(askQuestions, askDrafts.drafts)
    const first = questionAnswers[0]
    void onReply({
      requestId,
      reply: AgentGateReply.Once,
      selectedOptionIds: first?.selectedOptionIds,
      message: first?.message,
      questionAnswers
    })
  }

  const reject = (message?: string) => {
    void onReply({
      requestId,
      reply: AgentGateReply.Reject,
      message
    })
  }

  return (
    <View style={[styles.actions, { borderTopColor: colors.borderMuted }]}>
      {showFeedback ? (
        <>
          <Button
            variant="outline"
            onPress={onCancelFeedback}
            disabled={isReplying}
            style={styles.actionButton}
          >
            {t('common.cancel', '取消')}
          </Button>
          <Button
            variant="outline"
            onPress={() => reject(feedback.trim() || undefined)}
            disabled={isReplying}
            style={styles.actionButton}
          >
            {proactiveOptions
              ? t('agent_gate.submit_answer', '提交回答')
              : t('agent_gate.reject', '拒绝')}
          </Button>
        </>
      ) : proactiveOptions ? (
        pagedAsk ? (
          <View style={styles.askFooter}>
            <CompanionAskFields
              part="footer"
              questions={askQuestions}
              isReplying={isReplying}
              drafts={askDrafts}
              pageIndex={askPage}
              onPageIndexChange={onAskPageChange}
              onSkip={() => reject()}
              onSubmit={submitAsk}
            />
          </View>
        ) : (
          <>
            <Button
              variant="outline"
              destructive
              onPress={() => reject()}
              disabled={isReplying}
              style={styles.actionButton}
              accessibilityLabel={t('agent_gate.reject', '拒绝')}
            >
              {t('agent_gate.reject', '拒绝')}
            </Button>
            <Button
              variant="outline"
              onPress={submitAsk}
              disabled={isReplying || !askDrafts.complete}
              style={styles.actionButton}
            >
              {t('agent_gate.confirm', '确认')}
            </Button>
          </>
        )
      ) : (
        <>
          <Button
            variant="outline"
            destructive
            onPress={() => (allowCustomInput ? onShowFeedback() : reject())}
            disabled={isReplying}
            style={styles.actionButton}
            accessibilityLabel={t('agent_gate.reject', '拒绝')}
          >
            {t('agent_gate.reject', '拒绝')}
          </Button>
          {showAlways ? (
            <Button
              variant="outline"
              onPress={() => void onReply({ requestId, reply: AgentGateReply.Always })}
              disabled={isReplying}
              style={styles.actionButton}
              accessibilityLabel={t('agent_gate.always', '始终允许')}
            >
              {t('agent_gate.always', '始终允许')}
            </Button>
          ) : null}
          <Button
            variant="outline"
            onPress={() => void onReply({ requestId, reply: AgentGateReply.Once })}
            disabled={isReplying}
            style={styles.actionButton}
            accessibilityLabel={t('agent_gate.once', '本次允许')}
          >
            {t('agent_gate.once', '本次允许')}
          </Button>
        </>
      )}
    </View>
  )
}
