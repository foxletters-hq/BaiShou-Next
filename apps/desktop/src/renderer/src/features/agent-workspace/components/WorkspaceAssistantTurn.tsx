import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AgentMarkdownRenderer,
  AgentThinkSection,
  AgentToolChainSection,
  ChatBubbleInlineEditor,
  KnowledgeCitationBlock,
  MessageActionBar,
  parseRedactedThinking
} from '@baishou/ui'
import {
  collectKnowledgeCitationsFromInvocations,
  readAssistantStreamStatus,
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

export function WorkspaceAssistantTurn(props: {
  msg: WorkspaceChatMessage
  dimmed?: boolean
  editingActive: boolean
  onEditingChange: (messageId: string | null) => void
  onSelectChange?: (change: WorkspaceChangeEntry) => void
  bubbleActions?: WorkspaceBubbleActions
}) {
  const { t } = useTranslation()
  const { msg, dimmed, editingActive, onEditingChange, onSelectChange, bubbleActions } = props
  const timeline = buildWorkspaceAssistantTimeline(msg.parts)
  const timelineGroups = groupWorkspaceAssistantTimeline(timeline)
  const assistantText =
    timeline
      .filter((item) => item.kind === 'text')
      .map((item) => (item.kind === 'text' ? item.text : ''))
      .join('\n')
      .trim() || getWorkspaceAssistantText(msg)
  const knowledgeCitations = collectKnowledgeCitationsFromInvocations(
    timeline
      .filter((item): item is Extract<typeof item, { kind: 'tool' }> => item.kind === 'tool')
      .map((item) => item.invocation)
  )
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

  return (
    <div
      className={`chat-bubble-container ${styles.turn} ${styles.assistantTurn}${
        dimmed ? ` ${styles.turnDimmed}` : ''
      }`}
    >
      {timelineGroups.length > 0
        ? timelineGroups.map((item) => {
            if (item.kind === 'text' && editingActive) return null
            if (item.kind === 'reasoning') {
              return <AgentThinkSection key={item.key} content={item.text} />
            }
            if (item.kind === 'text') {
              const parsed = parseRedactedThinking(item.text)
              return (
                <React.Fragment key={item.key}>
                  {parsed.cleanReasoning ? (
                    <AgentThinkSection content={parsed.cleanReasoning} />
                  ) : null}
                  {parsed.cleanContent ? (
                    <AgentMarkdownRenderer content={parsed.cleanContent} />
                  ) : !parsed.cleanReasoning ? (
                    <AgentMarkdownRenderer content={item.text} />
                  ) : null}
                </React.Fragment>
              )
            }
            if (item.kind === 'tools') {
              return <AgentToolChainSection key={item.key} invocations={item.invocations} />
            }
            if (item.kind === 'file_change_failed') {
              return (
                <div key={item.key} className={styles.fileChangeError}>
                  {t('file_change.failed', '文件变更失败')}: {item.data.path}
                </div>
              )
            }
            return (
              <WorkspaceFileChangeList
                key={item.key}
                changes={buildFileOpEntries(
                  msg.id,
                  item.invocations,
                  item.items.map((entry) => entry.data)
                )}
                onSelectChange={(change) => onSelectChange?.(change)}
              />
            )
          })
        : fallbackParsed ? (
            <>
              {fallbackParsed.cleanReasoning ? (
                <AgentThinkSection content={fallbackParsed.cleanReasoning} />
              ) : null}
              {fallbackParsed.cleanContent ? (
                <AgentMarkdownRenderer content={fallbackParsed.cleanContent} />
              ) : null}
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
      {knowledgeCitations.length > 0 ? (
        <KnowledgeCitationBlock citations={knowledgeCitations} />
      ) : null}
      {msg.streamStatus === 'in_progress' ||
      readAssistantStreamStatus(msg.parts) === 'in_progress' ? (
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
              bubbleActions?.onRegenerate
                ? () => bubbleActions.onRegenerate?.(msg.id)
                : undefined
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
    </div>
  )
}
