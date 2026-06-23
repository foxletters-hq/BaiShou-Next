import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  AgentGateReply,
  type AgentGatePartData,
  type AgentGateRequest
} from '@baishou/shared'
import styles from './AgentGatePartBubble.module.css'

export interface AgentGatePartBubbleProps {
  data: AgentGatePartData
}

function replyLabel(
  t: (key: string, fallback: string) => string,
  reply?: AgentGateReply
): string {
  switch (reply) {
    case AgentGateReply.Once:
      return t('agent_gate.once', '本次允许')
    case AgentGateReply.Always:
      return t('agent_gate.always', '始终允许')
    case AgentGateReply.Reject:
      return t('agent_gate.reject', '拒绝')
    default:
      return t('agent_gate.pending_badge', '待确认')
  }
}

function selectedOptionLabel(request: AgentGateRequest, selectedOptionIds?: string[]): string | null {
  const selectedId = selectedOptionIds?.[0]
  if (!selectedId) return null
  return request.options.find((option) => option.id === selectedId)?.label ?? null
}

export const AgentGatePartBubble: React.FC<AgentGatePartBubbleProps> = ({ data }) => {
  const { t } = useTranslation()
  const { request, resolution } = data
  const resolved = Boolean(resolution)
  const optionLabel = selectedOptionLabel(request, resolution?.selectedOptionIds)

  return (
    <div className={styles.bubble} data-resolved={resolved ? 'true' : 'false'}>
      <div className={styles.badge}>
        {resolved
          ? t('agent_gate.resolved_badge', '已确认')
          : t('agent_gate.pending_badge', '待确认')}
      </div>
      <div className={styles.title}>{request.title}</div>
      {request.description ? <div className={styles.description}>{request.description}</div> : null}
      {resolved ? (
        <div className={styles.meta}>
          {replyLabel(t, resolution?.reply)}
          {optionLabel ? ` · ${optionLabel}` : null}
          {resolution?.message ? ` · ${resolution.message}` : null}
        </div>
      ) : null}
    </div>
  )
}
