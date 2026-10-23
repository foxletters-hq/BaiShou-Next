import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AgentGatePartBubble,
  AgentMarkdownRenderer,
  AgentProcessSection,
  AgentThinkSection,
  AgentToolChainSection,
  ChatBubbleInlineEditor,
  KnowledgeCitationBlock,
  MessageActionBar,
  parseRedactedThinking
} from '@baishou/ui'
import {
  collectAgentGatePartDataForSurface,
  collectKnowledgeCitationsFromInvocations,
  decorateKnowledgeCitedTexts,
  readAssistantStreamStatus,
  type MockToolInvocation,
  type WorkspaceChangeEntry
} from '@baishou/shared'
import type { WorkspaceChatMessage } from '../hooks/useWorkspaceChatMessages'
import { getWorkspaceAssistantText } from '../utils/workspace-message-display.util'
import {
  buildFileOpEntries,
  buildWorkspaceAssistantTimeline,
  groupWorkspaceAssistantTimeline
} from '../utils/workspace-message-parts.util'
import { copyWorkspaceBubbleText } from '../utils/workspace-copy-text.util'
import { WorkspaceFileChangeList } from './WorkspaceFileChangeList'
import type { WorkspaceBubbleActions } from './workspace-bubble-actions.types'
import styles from './AgentWorkspaceMessageList.module.css'

function WorkspaceAssistantTurnInner(props: {
  msg: WorkspaceChatMessage
  dimmed?: boolean
  editingActive: boolean
  onEditingChange: (messageId: string | null) => void
  onSelectChange?: (change: WorkspaceChangeEntry) => void
  onReviewAll?: (changes: WorkspaceChangeEntry[]) => void
  bubbleActions?: WorkspaceBubbleActions
  /** 仍在等确认卡时，不要把中途落盘显示成「回复中断」 */
  suppressIncompleteBanner?: boolean
}) {
  const { t } = useTranslation()
  const {
    msg,
    dimmed,
    editingActive,
    onEditingChange,
    onSelectChange,
    onReviewAll,
    bubbleActions,
    suppressIncompleteBanner = false
  } = props
  const gateParts = useMemo(
    () => collectAgentGatePartDataForSurface(msg.parts, 'workspace'),
    [msg.parts]
  )
  const timeline = useMemo(() => buildWorkspaceAssistantTimeline(msg.parts), [msg.parts])
  const timelineGroups = useMemo(
    () => groupWorkspaceAssistantTimeline(timeline, gateParts),
    [timeline, gateParts]
  )
  const assistantText = useMemo(
    () =>
      timeline
        .filter((item) => item.kind === 'text')
        .map((item) => (item.kind === 'text' ? item.text : ''))
        .join('\n')
        .trim() || getWorkspaceAssistantText(msg),
    [timeline, msg]
  )
  const knowledgeCitations = useMemo(
    () =>
      collectKnowledgeCitationsFromInvocations(
        timeline
          .filter((item): item is Extract<typeof item, { kind: 'tool' }> => item.kind === 'tool')
          .map((item) => item.invocation)
      ),
    [timeline]
  )
  const citedTextByKey = useMemo(() => {
    const textGroups = timelineGroups.filter((item) => item.kind === 'text')
    const decorated = decorateKnowledgeCitedTexts(
      textGroups.map((item) => {
        const parsed = parseRedactedThinking(item.text)
        return parsed.cleanContent || (!parsed.cleanReasoning ? item.text : '')
      }),
      knowledgeCitations.length,
      msg.id,
      { appendWhenMissing: true, citations: knowledgeCitations }
    )
    return new Map(textGroups.map((item, index) => [item.key, decorated[index] ?? ''] as const))
  }, [timelineGroups, knowledgeCitations, msg.id])
  const [editedContent, setEditedContent] = useState(assistantText)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editingActive) setEditedContent(assistantText)
  }, [assistantText, editingActive])

  const canEdit = Boolean(bubbleActions?.onSaveAssistantEdit)
  const showActionBar = Boolean(
    bubbleActions?.onRegenerate ||
    bubbleActions?.onDelete ||
    bubbleActions?.onShowContext ||
    canEdit ||
    assistantText
  )

  const saveEdit = async () => {
    if (!bubbleActions?.onSaveAssistantEdit) return
    const applied = await bubbleActions.onSaveAssistantEdit(msg.id, editedContent)
    if (applied) onEditingChange(null)
  }

  const fallbackParsed =
    timelineGroups.length === 0 ? parseRedactedThinking(assistantText, msg.reasoning ?? '') : null
  const fallbackCited = fallbackParsed?.cleanContent
    ? (decorateKnowledgeCitedTexts(
        [fallbackParsed.cleanContent],
        knowledgeCitations.length,
        msg.id,
        {
          appendWhenMissing: true,
          citations: knowledgeCitations
        }
      )[0] ?? fallbackParsed.cleanContent)
    : ''

  let lastActiveWorkIndex = -1
  for (let i = 0; i < timelineGroups.length; i += 1) {
    const item = timelineGroups[i]!
    if (item.kind === 'reasoning' && item.text.trim()) {
      lastActiveWorkIndex = i
    } else if (item.kind !== 'text') {
      lastActiveWorkIndex = i
    } else if (parseRedactedThinking(item.text).cleanReasoning.trim()) {
      lastActiveWorkIndex = i
    }
  }

  const processSteps: React.ReactNode[] = []
  const answerNodes: React.ReactNode[] = []
  const reasoningSegments: string[] = []
  const processInvocations: MockToolInvocation[] = []

  for (const [index, item] of timelineGroups.entries()) {
    if (item.kind === 'gate') {
      processSteps.push(<AgentGatePartBubble key={item.key} data={item.data} />)
      continue
    }
    if (item.kind === 'reasoning') {
      const parsed = parseRedactedThinking('', item.text)
      const content = (parsed.cleanReasoning || item.text).trim()
      if (!content) continue
      reasoningSegments.push(content)
      processSteps.push(<AgentThinkSection key={item.key} content={content} />)
      continue
    }
    if (item.kind === 'text') {
      const parsed = parseRedactedThinking(item.text)
      const cited = citedTextByKey.get(item.key)
      const cleanReasoning = parsed.cleanReasoning.trim()
      if (cleanReasoning) {
        reasoningSegments.push(cleanReasoning)
        processSteps.push(<AgentThinkSection key={`${item.key}:think`} content={cleanReasoning} />)
      }
      if (cited?.trim()) {
        if (index < lastActiveWorkIndex) {
          reasoningSegments.push(cited.trim())
          processSteps.push(<AgentThinkSection key={item.key} content={cited} />)
        } else if (!editingActive) {
          answerNodes.push(<AgentMarkdownRenderer key={item.key} content={cited} />)
        }
      }
      continue
    }
    if (item.kind === 'tools') {
      processInvocations.push(...item.invocations)
      processSteps.push(<AgentToolChainSection key={item.key} invocations={item.invocations} />)
      continue
    }
    if (item.kind === 'file_change_failed') {
      processSteps.push(
        <div key={item.key} className={styles.fileChangeError}>
          {t('file_change.failed', '文件变更失败')}: {item.data.path}
        </div>
      )
      continue
    }
    const changes = buildFileOpEntries(
      msg.id,
      item.invocations,
      item.items.map((entry) => entry.data)
    )
    if (item.invocations.length > 0) {
      processInvocations.push(...item.invocations)
    } else {
      for (const change of changes) {
        processInvocations.push({
          toolCallId: change.id,
          toolName: change.kind,
          state: 'result',
          args: { path: change.path },
          result: change.path
        })
      }
    }
    processSteps.push(
      <WorkspaceFileChangeList
        key={item.key}
        changes={changes}
        onSelectChange={(change) => onSelectChange?.(change)}
        onReviewAll={onReviewAll}
      />
    )
  }

  const combinedReasoning = reasoningSegments.join('\n\n')
  const hasAnswerText = Boolean(
    answerNodes.length > 0 || (editingActive && assistantText.trim().length > 0)
  )

  return (
    <div
      className={`chat-bubble-container ${styles.turn} ${styles.assistantTurn}${
        dimmed ? ` ${styles.turnDimmed}` : ''
      }`}
    >
      <KnowledgeCitationBlock citations={knowledgeCitations} anchorKey={msg.id}>
        {timelineGroups.length > 0 ? (
          <>
            {processSteps.length > 0 ? (
              <AgentProcessSection
                reasoningContent={combinedReasoning || undefined}
                invocations={processInvocations}
                hasAnswerText={hasAnswerText}
              >
                {processSteps}
              </AgentProcessSection>
            ) : null}
            {answerNodes}
          </>
        ) : fallbackParsed ? (
          <>
            {fallbackParsed.cleanReasoning ? (
              <AgentProcessSection
                reasoningContent={fallbackParsed.cleanReasoning}
                hasAnswerText={Boolean(fallbackCited)}
              >
                <AgentThinkSection content={fallbackParsed.cleanReasoning} />
              </AgentProcessSection>
            ) : null}
            {fallbackCited ? <AgentMarkdownRenderer content={fallbackCited} /> : null}
          </>
        ) : null}
        {editingActive ? (
          <ChatBubbleInlineEditor
            isUser={false}
            editedContent={editedContent}
            onChange={setEditedContent}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                onEditingChange(null)
                return
              }
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault()
                void saveEdit()
              }
            }}
            onCancel={() => onEditingChange(null)}
            onSave={() => {
              void saveEdit()
            }}
            textareaRef={textareaRef}
          />
        ) : null}
        {!suppressIncompleteBanner &&
        (msg.streamStatus === 'in_progress' ||
          readAssistantStreamStatus(msg.parts) === 'in_progress') ? (
          <p className={styles.streamIncomplete}>
            {t('workbench.reply_interrupted', '回复尚未完成，已保存到中断处')}
          </p>
        ) : null}
        {!editingActive && showActionBar ? (
          <div className={styles.turnActions}>
            <MessageActionBar
              isAI
              onCopy={() => copyWorkspaceBubbleText(assistantText)}
              onEdit={canEdit ? () => onEditingChange(msg.id) : undefined}
              onRetry={
                bubbleActions?.onRegenerate ? () => bubbleActions.onRegenerate?.(msg.id) : undefined
              }
              onDelete={
                bubbleActions?.onDelete ? () => bubbleActions.onDelete?.(msg.id) : undefined
              }
              onShowContext={
                bubbleActions?.onShowContext ? () => bubbleActions.onShowContext?.(msg) : undefined
              }
            />
          </div>
        ) : null}
      </KnowledgeCitationBlock>
    </div>
  )
}

export const WorkspaceAssistantTurn = React.memo(WorkspaceAssistantTurnInner)
