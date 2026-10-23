import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  AgentGatePartBubble,
  AgentMarkdownRenderer,
  AgentProcessSection,
  AgentThinkSection,
  AgentToolChainSection,
  KnowledgeCitationBlock,
  MessageActionBar,
  parseRedactedThinking
} from '@baishou/ui'
import {
  collectKnowledgeCitationsFromInvocations,
  decorateKnowledgeCitedTexts,
  type AgentGatePartData,
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
    asThink?: boolean
    failedByName: Map<string, string>
    onSelectChange?: (change: WorkspaceChangeEntry) => void
    onReviewAll?: (changes: WorkspaceChangeEntry[]) => void
    gateChanges?: WorkspaceChangeEntry[]
    citedTextByIndex?: Map<number, string>
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
    const content =
      options.citedTextByIndex?.get(index) ||
      parsed.cleanContent ||
      (!parsed.cleanReasoning ? item.text : '')
    const cleanReasoning = parsed.cleanReasoning.trim()
    if (!cleanReasoning && !content.trim()) return null
    if (options.asThink) {
      return (
        <React.Fragment key={`stream-text-${index}`}>
          {cleanReasoning ? (
            <AgentThinkSection
              content={cleanReasoning}
              isStreaming={options.isStreaming && options.isLast && !content.trim()}
            />
          ) : null}
          {content.trim() ? (
            <AgentThinkSection
              content={content}
              isStreaming={options.isStreaming && options.isLast}
            />
          ) : null}
        </React.Fragment>
      )
    }
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

  if (item.kind === 'gate') {
    return <AgentGatePartBubble key={item.data.request.id} data={item.data} />
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
  gateParts?: AgentGatePartData[]
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
    pendingAsk,
    gateParts = []
  } = props
  const gateChanges = workspaceChangesFromGateRequest(pendingAsk)
  const streamGroups = useLiveTimeline ? groupStreamTimelineItems(streamingTimeline, gateParts) : []
  const streamHasFileOps = streamGroups.some((item) => item.kind === 'file_ops')
  const knowledgeCitations = collectKnowledgeCitationsFromInvocations(
    streamingTimeline
      .filter(
        (item): item is Extract<AgentStreamTimelineItem, { kind: 'tool' }> => item.kind === 'tool'
      )
      .map(streamToolToInvocation)
  )
  const citedTextByIndex = new Map(
    (() => {
      const textGroups = streamGroups.flatMap((item, index) =>
        item.kind === 'text' ? [{ index, text: item.text }] : []
      )
      const decorated = decorateKnowledgeCitedTexts(
        textGroups.map((item) => {
          const parsed = parseRedactedThinking(item.text, '')
          return parsed.cleanContent || (!parsed.cleanReasoning ? item.text : '')
        }),
        knowledgeCitations.length,
        'streaming',
        { appendWhenMissing: false }
      )
      return textGroups.map((item, offset) => [item.index, decorated[offset] ?? ''] as const)
    })()
  )

  const liveStreaming = Boolean(isStreaming && !isBridgeActive && !streamError)
  const hasTrailingGateChanges = !streamHasFileOps && gateChanges.length > 0
  let lastActiveWorkIndex = hasTrailingGateChanges ? streamGroups.length : -1
  if (!hasTrailingGateChanges) {
    for (let i = 0; i < streamGroups.length; i += 1) {
      const group = streamGroups[i]!
      if (group.kind === 'reasoning' && group.text.trim()) {
        lastActiveWorkIndex = i
      } else if (group.kind !== 'text') {
        lastActiveWorkIndex = i
      } else if (parseRedactedThinking(group.text, '').cleanReasoning.trim()) {
        lastActiveWorkIndex = i
      }
    }
  }

  const processSteps: React.ReactNode[] = []
  const answerNodes: React.ReactNode[] = []
  const reasoningSegments: string[] = []
  const timelineCompletedTools: Array<{ name: string; durationMs: number }> = []
  let timelineActiveToolName: string | null = null

  if (useLiveTimeline) {
    for (const [index, item] of streamGroups.entries()) {
      const isLast =
        !hasTrailingGateChanges &&
        (index === streamGroups.length - 1 ||
          streamGroups.slice(index + 1).every((entry) => entry.kind === 'gate'))
      if (item.kind === 'reasoning') {
        const parsed = parseRedactedThinking('', item.text)
        const content = (parsed.cleanReasoning || item.text).trim()
        if (content) reasoningSegments.push(content)
      } else if (item.kind === 'text') {
        const parsed = parseRedactedThinking(item.text, '')
        const cleanReasoning = parsed.cleanReasoning.trim()
        const content = (
          citedTextByIndex.get(index) ||
          parsed.cleanContent ||
          (!cleanReasoning ? item.text : '')
        ).trim()
        if (cleanReasoning) reasoningSegments.push(cleanReasoning)
        if (index < lastActiveWorkIndex) {
          if (content) reasoningSegments.push(content)
        } else {
          if (cleanReasoning) {
            processSteps.push(
              <AgentThinkSection
                key={`stream-text-think-${index}`}
                content={cleanReasoning}
                isStreaming={liveStreaming && isLast && !content}
              />
            )
          }
          if (content) {
            const node = renderStreamTimelineItem(item, index, {
              isStreaming: liveStreaming,
              isLast,
              asThink: false,
              failedByName,
              onSelectChange,
              onReviewAll,
              gateChanges,
              citedTextByIndex
            })
            if (node) answerNodes.push(node)
          }
          continue
        }
      } else if (item.kind === 'tools' || item.kind === 'file_ops') {
        for (const tool of item.items) {
          if (tool.status === 'running') {
            timelineActiveToolName = tool.name
          } else {
            timelineCompletedTools.push({
              name: tool.name,
              durationMs: tool.durationMs ?? 0
            })
          }
        }
      }

      const stepNode = renderStreamTimelineItem(item, index, {
        isStreaming: liveStreaming,
        isLast,
        asThink: true,
        failedByName,
        onSelectChange,
        onReviewAll,
        gateChanges,
        citedTextByIndex
      })
      if (stepNode) processSteps.push(stepNode)
    }

    if (hasTrailingGateChanges) {
      for (const change of gateChanges) {
        timelineCompletedTools.push({ name: change.kind, durationMs: 0 })
      }
      processSteps.push(
        <WorkspaceFileChangeList
          key="stream-gate-files"
          changes={gateChanges}
          running
          onSelectChange={onSelectChange ?? (() => undefined)}
          onReviewAll={onReviewAll}
        />
      )
    }
  }

  const combinedTimelineReasoning = reasoningSegments.join('\n\n')
  const effectiveActiveToolName = timelineActiveToolName ?? activeToolName ?? null
  const processIsStreaming = Boolean(liveStreaming && answerNodes.length === 0)

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
      <KnowledgeCitationBlock citations={knowledgeCitations} anchorKey="streaming">
        {useLiveTimeline ? (
          <>
            {processSteps.length > 0 || processIsStreaming ? (
              <AgentProcessSection
                reasoningContent={combinedTimelineReasoning || undefined}
                streamingCompletedTools={timelineCompletedTools}
                activeToolName={streamError ? null : effectiveActiveToolName}
                isReasoningLoading={processIsStreaming && !effectiveActiveToolName}
                isReasoningStreaming={processIsStreaming && !effectiveActiveToolName}
                isStreaming={liveStreaming}
                hasAnswerText={answerNodes.length > 0}
              >
                {processSteps}
              </AgentProcessSection>
            ) : null}
            {answerNodes}
          </>
        ) : (
          <>
            {streamHasReasoning || streamHasTools ? (
              <AgentProcessSection
                reasoningContent={streamHasReasoning ? streamingParsed.cleanReasoning : undefined}
                isReasoningLoading={Boolean(streamingReasoning && !streamingParsed.cleanContent)}
                isReasoningStreaming={Boolean(streamingReasoning && !streamingParsed.cleanContent)}
                streamingCompletedTools={streamingCompletedTools.filter((tool) => !tool.error)}
                activeToolName={streamError ? null : activeToolName}
                isStreaming={liveStreaming}
                hasAnswerText={streamHasText}
              >
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
              </AgentProcessSection>
            ) : null}
            {streamHasText ? (
              <AgentMarkdownRenderer
                content={
                  decorateKnowledgeCitedTexts(
                    [streamingParsed.cleanContent],
                    knowledgeCitations.length,
                    'streaming'
                  )[0] ?? streamingParsed.cleanContent
                }
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
      </KnowledgeCitationBlock>
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
        <AgentProcessSection
          reasoningContent={pendingAssistantMsg.reasoning}
          hasAnswerText={Boolean(pendingAssistantMsg.content)}
        >
          <AgentThinkSection content={pendingAssistantMsg.reasoning} />
        </AgentProcessSection>
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
