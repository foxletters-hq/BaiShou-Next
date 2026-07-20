import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AgentGateKind, AgentGateReply, type AgentGateRequest } from '@baishou/shared'
import {
  resolveAlwaysAllowPrefixHint,
  shouldShowAlwaysAllow,
  shouldShowCustomRejectInput,
  shouldShowProactiveOptions,
  type AgentGateReplyPayload
} from '../../agent-gate'
import styles from './AgentGateDock.module.css'

export interface AgentGateDockProps {
  request: AgentGateRequest | null
  isReplying?: boolean
  onReply: (input: AgentGateReplyPayload) => void | Promise<void>
}

export const AgentGateDock: React.FC<AgentGateDockProps> = ({
  request,
  isReplying = false,
  onReply
}) => {
  const { t } = useTranslation()
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)

  useEffect(() => {
    setShowFeedback(false)
    setFeedback('')
    setSelectedOptionId(null)
  }, [request?.id])

  if (!request) return null

  const proactiveOptions = shouldShowProactiveOptions(request)
  const showAlways = shouldShowAlwaysAllow(request)
  const alwaysPrefixHint = resolveAlwaysAllowPrefixHint(request)
  const allowCustomInput = shouldShowCustomRejectInput(request)
  const showActionMeta = request.kind === AgentGateKind.Tool
  const showWorkspaceRunAlwaysHint = request.action === 'workspace_run'

  const handleReject = () => {
    if (allowCustomInput) {
      setShowFeedback(true)
      return
    }
    void onReply({ requestId: request.id, reply: AgentGateReply.Reject })
  }

  const submitRejectWithFeedback = () => {
    void onReply({
      requestId: request.id,
      reply: AgentGateReply.Reject,
      message: feedback.trim() || undefined
    })
    setShowFeedback(false)
    setFeedback('')
  }

  const submitProactiveConfirm = () => {
    if (!selectedOptionId) return
    void onReply({
      requestId: request.id,
      reply: AgentGateReply.Once,
      selectedOptionIds: [selectedOptionId]
    })
  }

  return (
    <div className={styles.overlay} role="presentation">
      <section
        className={styles.dock}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-gate-dock-title"
      >
        <h2 id="agent-gate-dock-title" className={styles.title}>
          {request.title || t('agent_gate.dock_title', '伙伴操作确认')}
        </h2>
        {request.description ? (
          <p className={styles.description}>{request.description}</p>
        ) : (
          <p className={styles.description}>
            {request.kind === AgentGateKind.Proactive
              ? t('agent_gate.proactive_desc', '伙伴想向你确认一个问题。')
              : request.kind === AgentGateKind.Lifecycle
                ? t('agent_gate.lifecycle_desc', '会话即将进入自动处理流程，需要你确认。')
                : t('agent_gate.dock_desc', '伙伴想要执行一项需要你确认的操作。')}
          </p>
        )}

        {showActionMeta ? (
          <p className={styles.meta}>
            {t('agent_gate.dock_action', '操作：{{action}}', { action: request.action })}
          </p>
        ) : null}

        {request.fingerprint ? (
          <p className={styles.meta}>
            {t('agent_gate.fingerprint_meta', '指纹 {{fp}} · 连打 {{count}}', {
              fp: request.fingerprint.slice(0, 10),
              count: request.repeatCount ?? 1
            })}
          </p>
        ) : null}

        {showWorkspaceRunAlwaysHint && !proactiveOptions ? (
          <p className={styles.meta}>
            {alwaysPrefixHint
              ? t('agent_gate.always_prefix_hint', '始终允许将写入前缀：{{pattern}}', {
                  pattern: alwaysPrefixHint
                })
              : t('agent_gate.always_not_available', '此命令不可始终允许')}
          </p>
        ) : null}

        {proactiveOptions && !showFeedback ? (
          <div className={styles.options} role="radiogroup" aria-label={request.title}>
            {request.options.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selectedOptionId === option.id}
                className={`${styles.option} ${selectedOptionId === option.id ? styles.optionSelected : ''}`}
                onClick={() => setSelectedOptionId(option.id)}
              >
                <span className={styles.optionLabel}>{option.label}</span>
              </button>
            ))}
          </div>
        ) : null}

        {showFeedback ? (
          <div className={styles.feedback}>
            <textarea
              className={styles.feedbackInput}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={t(
                proactiveOptions
                  ? 'agent_gate.custom_answer_placeholder'
                  : 'agent_gate.reject_feedback_placeholder',
                proactiveOptions ? '输入你的回答或说明…' : '告诉伙伴为什么拒绝（可选）…'
              )}
              autoFocus
            />
            <div className={styles.feedbackActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnOnce}`}
                disabled={isReplying}
                onClick={() => {
                  setShowFeedback(false)
                  setFeedback('')
                }}
              >
                {t('common.cancel', '取消')}
              </button>
              <button
                type="button"
                className={`${styles.btn} ${proactiveOptions ? styles.btnOnce : styles.btnReject}`}
                disabled={isReplying}
                onClick={submitRejectWithFeedback}
              >
                {proactiveOptions
                  ? t('agent_gate.submit_answer', '提交回答')
                  : t('agent_gate.reject', '拒绝')}
              </button>
            </div>
          </div>
        ) : proactiveOptions ? (
          <div className={styles.actions}>
            {allowCustomInput ? (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnOnce}`}
                disabled={isReplying}
                onClick={() => setShowFeedback(true)}
              >
                {t('agent_gate.custom_answer', '自定义回答')}
              </button>
            ) : null}
            <button
              type="button"
              className={`${styles.btn} ${styles.btnReject}`}
              disabled={isReplying}
              onClick={handleReject}
            >
              {t('agent_gate.reject', '拒绝')}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnAlways}`}
              disabled={isReplying || !selectedOptionId}
              onClick={submitProactiveConfirm}
            >
              {t('agent_gate.confirm', '确认')}
            </button>
          </div>
        ) : (
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnReject}`}
              disabled={isReplying}
              onClick={handleReject}
            >
              {t('agent_gate.reject', '拒绝')}
            </button>
            {showAlways ? (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnAlways}`}
                disabled={isReplying}
                onClick={() =>
                  void onReply({ requestId: request.id, reply: AgentGateReply.Always })
                }
              >
                {t('agent_gate.always', '始终允许')}
              </button>
            ) : null}
            <button
              type="button"
              className={`${styles.btn} ${styles.btnOnce}`}
              disabled={isReplying}
              onClick={() => void onReply({ requestId: request.id, reply: AgentGateReply.Once })}
            >
              {t('agent_gate.once', '本次允许')}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
