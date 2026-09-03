import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ChevronRight,
  CircleX,
  FileDiff,
  FilePen,
  FileText,
  FileX,
  FolderTree,
  Globe,
  Link2,
  Loader2,
  MessageCircleQuestion,
  Search,
  Sparkles,
  Terminal,
  Wrench
} from 'lucide-react'
import type { MockToolInvocation } from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { formatToolDurationMs, type AgentToolChainItemModel } from '../../shared/agent-tool-chain'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import {
  getToolDisplayName,
  getToolRowSubtitle,
  resolveCompanionAskPresentation
} from '../../shared/tool-result.util'
import { AgentGateReply } from '@baishou/shared'
import { CompanionAskResultCard } from './CompanionAskResultCard'
import { useCompanionAskInteraction } from './companion-ask-interaction'
import {
  matchCompanionAskPendingRequest,
  presentationFromCompanionAskRequest
} from './companion-ask-interaction.util'
import { ToolResultContent } from './ToolResultContent'
import styles from './AgentToolChainSection.module.css'

const ROW_ICON_SIZE = 14

const TOOL_ROW_ICONS: Record<string, LucideIcon> = {
  workspace_list: FolderTree,
  workspace_read: FileText,
  workspace_write: FilePen,
  workspace_patch: FileDiff,
  workspace_delete: FileX,
  workspace_rename: FileDiff,
  workspace_run: Terminal,
  web_search: Globe,
  url_read: Link2,
  diary_search: Search,
  vector_search: Search,
  message_search: Search,
  knowledge_search: Search,
  knowledge_graph_search: Search,
  skill_write: Sparkles,
  companion_ask: MessageCircleQuestion
}

export interface AgentToolThinkItemProps {
  model: AgentToolChainItemModel
  /** 流式进行中时自动展开 */
  autoExpand?: boolean
}

export const AgentToolThinkItem = React.memo(function AgentToolThinkItem({
  model,
  autoExpand = false
}: AgentToolThinkItemProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const askInteraction = useCompanionAskInteraction()

  const isLoading = model.status === 'loading'
  const invocation = model.invocation as MockToolInvocation | undefined
  const askPresentation = useMemo(() => {
    if (model.status === 'error') return null
    if (invocation) return resolveCompanionAskPresentation(invocation)
    if (model.toolName === 'companion_ask' && askInteraction?.pending) {
      return presentationFromCompanionAskRequest(askInteraction.pending)
    }
    return null
  }, [askInteraction?.pending, invocation, model.status, model.toolName])
  const pendingAsk = matchCompanionAskPendingRequest(
    askInteraction?.pending,
    askPresentation,
    model.toolName
  )
  const canExpand = Boolean(model.hasContent && invocation && !isLoading && !askPresentation)

  useEffect(() => {
    if (autoExpand && canExpand) {
      setExpanded(true)
    }
  }, [autoExpand, canExpand])

  const displayTitle = useMemo(() => {
    if (invocation != null) {
      return getToolDisplayName(invocation, (key, fallback) => t(key, fallback))
    }
    return t(`agent.tools.${model.toolName}`, model.toolName)
  }, [invocation, model.toolName, t])

  const subtitle = useMemo(
    () => getToolRowSubtitle(invocation, model.status, (key, fallback) => t(key, fallback)),
    [invocation, model.status, t]
  )

  const handleToggle = useCallback(() => {
    if (!canExpand) return
    setExpanded((prev) => !prev)
  }, [canExpand])

  if (askPresentation) {
    return (
      <div className={styles.item}>
        <CompanionAskResultCard
          data={askPresentation}
          pending={Boolean(pendingAsk)}
          allowCustomInput={Boolean(pendingAsk?.allowCustomInput)}
          isReplying={Boolean(askInteraction?.isReplying)}
          onSelectOption={
            pendingAsk
              ? (optionId) =>
                  void askInteraction?.onReply({
                    requestId: pendingAsk.id,
                    reply: AgentGateReply.Once,
                    selectedOptionIds: [optionId]
                  })
              : undefined
          }
          onSubmitCustom={
            pendingAsk
              ? (text) =>
                  void askInteraction?.onReply({
                    requestId: pendingAsk.id,
                    reply: AgentGateReply.Reject,
                    message: text
                  })
              : undefined
          }
        />
      </div>
    )
  }

  return (
    <div className={styles.item} data-expanded={expanded ? 'true' : 'false'}>
      <button
        type="button"
        className={styles.row}
        disabled={!canExpand}
        aria-expanded={canExpand ? expanded : undefined}
        onClick={handleToggle}
      >
        <span className={`${styles.icon} ${model.status === 'error' ? styles.errorIcon : ''}`}>
          <ToolRowIcon toolName={model.toolName} status={model.status} />
        </span>
        <span className={styles.labels}>
          <span className={`${styles.title} ${isLoading ? styles.titleLoading : ''}`}>
            {displayTitle}
          </span>
          {subtitle ? (
            <>
              <span className={styles.sep} aria-hidden="true">
                ·
              </span>
              <span className={styles.subtitle} title={subtitle}>
                {subtitle}
              </span>
            </>
          ) : (
            <span className={styles.subtitleSpacer} />
          )}
        </span>
        {model.durationMs != null ? (
          <span className={styles.duration}>{formatToolDurationMs(model.durationMs)}</span>
        ) : null}
        {canExpand ? (
          <ChevronRight
            className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}
            size={ROW_ICON_SIZE}
            strokeWidth={DEFAULT_STROKE_WIDTH}
            aria-hidden
          />
        ) : (
          <span className={styles.chevronSlot} aria-hidden />
        )}
      </button>
      {expanded && canExpand && invocation ? (
        <div className={styles.contentInner}>
          <ToolResultContent invocation={invocation} />
        </div>
      ) : null}
    </div>
  )
})

function ToolRowIcon({
  toolName,
  status
}: {
  toolName: string
  status: AgentToolChainItemModel['status']
}) {
  if (status === 'loading') {
    return <Loader2 className={styles.spin} size={ROW_ICON_SIZE} strokeWidth={DEFAULT_STROKE_WIDTH} />
  }
  if (status === 'error') {
    return <CircleX size={ROW_ICON_SIZE} strokeWidth={DEFAULT_STROKE_WIDTH} />
  }
  const Icon = TOOL_ROW_ICONS[toolName] ?? Wrench
  return <Icon size={ROW_ICON_SIZE} strokeWidth={DEFAULT_STROKE_WIDTH} />
}
