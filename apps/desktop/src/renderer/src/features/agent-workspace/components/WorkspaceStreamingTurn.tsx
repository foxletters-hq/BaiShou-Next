import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  AgentMarkdownRenderer,
  AgentThinkSection,
  AgentToolChainSection,
  MessageActionBar,
  parseRedactedThinking
} from '@baishou/ui'
import {
  type AgentGateRequest,
  type AgentStreamTimelineItem,
  type MockToolInvocation,
  type WorkspaceChangeEntry
} from '@baishou/shared'
import type { PendingWorkspaceAssistantMsg } from '../hooks/useWorkspaceChatMessages'
import type { WorkspaceToolError } from '../hooks/useWorkspaceAgentStream'
import { copyWorkspaceBubbleText } from '../utils/workspace-copy-text.util'
import {
  buildFileOpEntries,
  formatWorkspaceToolDisplayName,
  groupStreamTimelineItems,
  type WorkspaceStreamTimelineGroup
} from '../utils/workspace-message-parts.util'
import {
  mergeWorkspaceChangeEntries,
  workspaceChangesFromGateRequest
} from '../utils/workspace-gate-file-changes.util'
import { WorkspaceFileChangeList } from './WorkspaceFileChangeList'
import styles from './AgentWorkspaceMessageList.module.css'

export function BouncingDots() {
  return (
    <div className={styles.bouncingDots} aria-hidden>
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </div>
  )
}

function streamToolToInvocation(
  item: Extract<AgentStreamTimelineItem, { kind: 'tool' }>
): MockToolInvocation {
  return {
    toolCallId: item.callId,
    toolName: item.name,
    state: item.status === 'completed' ? 'result' : 'call',
    args: item.arguments ?? {},
    result: item.result
  }
}

function renderStreamFileOps(
  items: Array<Extract<AgentStreamTimelineItem, { kind: 'tool' }>>,
  options: {
    onSelectChange?: (change: WorkspaceChangeEntry) => void
    onReviewAll?: (changes: WorkspaceChangeEntry[]) => void
    gateChanges?: WorkspaceChangeEntry[]
  }
) {
  const changes = mergeWorkspaceChangeEntries(
    buildFileOpEntries('stream', items.map(streamToolToInvocation), []),
    options.gateChanges ?? []
  )
  if (changes.length === 0) return null
  return (
    <WorkspaceFileChangeList
      key={`stream-files-${items[0]?.callId ?? items[0]?.name}`}
      changes={changes}
      running={items.some((item) => item.status === 'running')}
      onSelectChange={options.onSelectChange ?? (() => undefined)}
      onReviewAll={options.onReviewAll}
    />
  )
}

function renderStreamToolGroup(
  items: Array<Extract<AgentStreamTimelineItem, { kind: 'tool' }>>,
  failedByName: Map<string, string>
) {
  const completed = items.filter((item) => item.status !== 'running')
  const running = items.find((item) => item.status === 'running')
  return (
    <AgentToolChainSection
      key={`stream-tools-${items[0]?.callId ?? items[0]?.name}`}
      completedTools={completed.map((item) => ({
        name: item.name,
        durationMs: item.durationMs ?? 0,
        toolCallId: item.callId,
        result: item.result,
        args: item.arguments,
        error: item.status === 'failed' ? failedByName.get(item.name) : undefined
      }))}
      activeToolName={running?.name ?? null}
      activeToolArgs={running?.arguments}
      isStreaming={Boolean(running)}
    />
  )
}

function renderStreamTimelineItem(
  item: WorkspaceStreamTimelineGroup,
  index: number,
  options: {
    isStreaming: boolean
    isLast: boolean
    failedByName: Map<string, string>
    onSelectChange?: (change: WorkspaceChangeEntry) => void
    onReviewAll?: (changes: WorkspaceChangeEntry[]) => void
    gateChanges?: WorkspaceChangeEntry[]
  }
) {
  if (item.kind === 'reasoning') {
    const parsed = parseRedactedThinking('', item.text)
    const content = parsed.cleanReasoning || item.text
    if (!content.trim()) return null
    return (
      <AgentThinkSection
        key={`stream-reasoning-${index}`}
        content={content}
        isStreaming={options.isStreaming && options.isLast}
      />
    )
  }
  if (item.kind === 'text') {
    const parsed = parseRedactedThinking(item.text, '')
    const content = parsed.cleanContent || item.text
    if (!content.trim()) return null
    return (
      <AgentMarkdownRenderer
        key={`stream-text-${index}`}
        content={content}
        isStreaming={options.isStreaming && options.isLast}
      />
    )
  }

  if (item.kind === 'file_ops') {
    return renderStreamFileOps(item.items, options)
  }

  return renderStreamToolGroup(item.items, options.failedByName)
}

export function WorkspaceStreamingTurn(props: {
  dimmed?: boolean
  streamError?: string | null
  useLiveTimeline: boolean
  streamingTimeline: AgentStreamTimelineItem[]
  isStreaming: boolean
  isBridgeActive: boolean
  streamHasReasoning: boolean
  streamHasTools: boolean
  streamHasText: boolean
  streamingParsed: { cleanReasoning: string; cleanContent: string }
  streamingReasoning?: string
  streamingCompletedTools: Array<{ name: string; durationMs: number; error?: string }>
  activeToolName?: string | null
  failedByName: Map<string, string>
  failedTools: WorkspaceToolError[]
  streamShowPlaceholder: boolean
  streamShowWaiting: boolean
  onSelectChange?: (change: WorkspaceChangeEntry) => void
  onReviewAll?: (changes: WorkspaceChangeEntry[]) => void
  pendingAsk?: AgentGateRequest | null
}) {
  const { t } = useTranslation()
  const {
    dimmed,
    streamError,
    useLiveTimeline,
    streamingTimeline,
    isStreaming,
    isBridgeActive,
    streamHasReasoning,
    streamHasTools,
    streamHasText,
    streamingParsed,
    streamingReasoning,
    streamingCompletedTools,
    activeToolName,
    failedByName,
    failedTools,
    streamShowPlaceholder,
    streamShowWaiting,
    onSelectChange,
    onReviewAll,
    pendingAsk
  } = props
  const gateChanges = workspaceChangesFromGateRequest(pendingAsk)
  const streamGroups = useLiveTimeline ? groupStreamTimelineItems(streamingTimeline) : []
  const streamHasFileOps = streamGroups.some((item) => item.kind === 'file_ops')

  return (
    <div
      className={`chat-bubble-container ${styles.turn} ${styles.assistantTurn}${
        dimmed ? ` ${styles.turnDimmed}` : ''
      }`}
    >
      {streamError ? (
        <div className={styles.streamError} role="alert">
          {streamError}
        </div>
      ) : null}
      {useLiveTimeline ? (
        <>
          {streamGroups.map((item, index, groups) =>
            renderStreamTimelineItem(item, index, {
              isStreaming: isStreaming && !isBridgeActive,
              isLast: index === groups.length - 1,
              failedByName,
              onSelectChange,
              onReviewAll,
              gateChanges
            })
          )}
          {!streamHasFileOps && gateChanges.length > 0 ? (
            <WorkspaceFileChangeList
              changes={gateChanges}
              running
              onSelectChange={onSelectChange ?? (() => undefined)}
              onReviewAll={onReviewAll}
            />
          ) : null}
        </>
      ) : (
        <>
          {streamHasReasoning ? (
            <AgentThinkSection
              content={streamingParsed.cleanReasoning}
              isStreaming={Boolean(streamingReasoning && !streamingParsed.cleanContent)}
            />
          ) : null}
          {streamHasTools ? (
            <AgentToolChainSection
              completedTools={streamingCompletedTools.filter((tool) => !tool.error)}
              activeToolName={activeToolName}
              isStreaming
            />
          ) : null}
          {streamHasText ? (
            <AgentMarkdownRenderer
              content={streamingParsed.cleanContent}
              isStreaming={isStreaming && !isBridgeActive}
            />
          ) : null}
        </>
      )}
      {streamShowPlaceholder || streamShowWaiting ? <BouncingDots /> : null}
      {failedTools.length > 0 || streamingCompletedTools.some((tool) => tool.error) ? (
        <ul className={styles.streamToolErrors}>
          {[
            ...failedTools.map((tool) => ({
              name: formatWorkspaceToolDisplayName(tool.name, t),
              error: tool.error
            })),
            ...streamingCompletedTools
              .filter((tool) => tool.error)
              .map((tool) => ({
                name: formatWorkspaceToolDisplayName(tool.name, t),
                error: tool.error!
              }))
          ].map((tool, index) => (
            <li key={`${tool.name}-stream-err-${index}`}>
              {tool.name}: {tool.error}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function WorkspacePendingAssistantTurn(props: {
  dimmed?: boolean
  pendingAssistantMsg: PendingWorkspaceAssistantMsg
}) {
  const { dimmed, pendingAssistantMsg } = props
  return (
    <div
      className={`chat-bubble-container ${styles.turn} ${styles.assistantTurn}${
        dimmed ? ` ${styles.turnDimmed}` : ''
      }`}
    >
      {pendingAssistantMsg.reasoning ? (
        <AgentThinkSection content={pendingAssistantMsg.reasoning} />
      ) : null}
      {pendingAssistantMsg.content ? (
        <AgentMarkdownRenderer content={pendingAssistantMsg.content} />
      ) : null}
      {pendingAssistantMsg.content ? (
        <div className={styles.turnActions}>
          <MessageActionBar
            isAI
            onCopy={() => copyWorkspaceBubbleText(pendingAssistantMsg.content)}
          />
        </div>
      ) : null}
    </div>
  )
}
