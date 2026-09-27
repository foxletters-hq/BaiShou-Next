import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import {
  AgentGateReply,
  shouldRenderAgentGateHistoryCard,
  type AgentGatePartData,
  type AgentGateRequest
} from '@baishou/shared'
import { summarizePreviewForHistory } from '../../agent-gate/agent-gate-preview-copy'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import styles from './AgentGatePartBubble.module.css'

export interface AgentGatePartBubbleProps {
  data: AgentGatePartData
}

function replyLabel(t: (key: string, fallback: string) => string, reply?: AgentGateReply): string {
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

function selectedOptionLabel(
  request: AgentGateRequest,
  selectedOptionIds?: string[]
): string | null {
  const selectedId = selectedOptionIds?.[0]
  if (!selectedId) return null
  return request.options.find((option) => option.id === selectedId)?.label ?? null
}

export const AgentGatePartBubble: React.FC<AgentGatePartBubbleProps> = ({ data }) => {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  if (!shouldRenderAgentGateHistoryCard(data)) return null
  const { request, resolution } = data
  const optionLabel = selectedOptionLabel(request, resolution?.selectedOptionIds)
  const previewSummary = summarizePreviewForHistory(request.preview)
  const numberedOptionsText =
    request.options.length > 0
      ? request.options.map((option, index) => `${index + 1}. ${option.label}`).join('\n')
      : null
  const descriptionIsOptionsDump =
    Boolean(request.description) && request.description?.trim() === numberedOptionsText
  const description =
    !request.preview &&
    request.description &&
    !descriptionIsOptionsDump &&
    request.description !== request.title &&
    !request.description.startsWith(`${request.title}：`) &&
    !request.description.startsWith(`${request.title}:`)
      ? request.description
      : null
  const preview = previewSummary && previewSummary !== request.title ? previewSummary : null
  const extra = [optionLabel, resolution?.message].filter(Boolean).join(' · ')
  const detail = [preview, description, extra].filter(Boolean).join('\n')
  const canExpand = detail.length > 0

  return (
    <div className={styles.item} data-expanded={expanded ? 'true' : 'false'}>
      <button
        type="button"
        className={styles.row}
        disabled={!canExpand}
        aria-expanded={canExpand ? expanded : undefined}
        onClick={() => {
          if (!canExpand) return
          setExpanded((open) => !open)
        }}
      >
        <span className={styles.title}>{request.title}</span>
        <span className={styles.sep} aria-hidden="true">
          ·
        </span>
        <span className={styles.subtitle}>{replyLabel(t, resolution?.reply)}</span>
        {canExpand ? (
          <ChevronRight
            className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}
            size={14}
            strokeWidth={DEFAULT_STROKE_WIDTH}
            aria-hidden
          />
        ) : (
          <span className={styles.chevronSlot} aria-hidden />
        )}
      </button>
      {expanded && canExpand ? <div className={styles.detail}>{detail}</div> : null}
    </div>
  )
}
