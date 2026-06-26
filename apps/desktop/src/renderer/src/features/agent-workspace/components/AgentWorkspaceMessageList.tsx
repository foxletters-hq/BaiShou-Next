import React, { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FileChangeCard, StreamingBubble, ToolResultGroup } from '@baishou/ui'
import type { FileChangePartData } from '@baishou/shared'
import type { WorkspaceChatMessage, PendingWorkspaceAssistantMsg } from '../hooks/useWorkspaceChatMessages'
import type { WorkspaceToolError } from '../hooks/useWorkspaceAgentStream'
import {
  getWorkspaceAssistantReasoning,
  getWorkspaceAssistantText,
  getWorkspaceUserText
} from '../utils/workspace-message-display.util'
import {
  collectWorkspaceFileChanges,
  extractToolInvocations,
  formatWorkspaceToolDisplayName,
  isFileChangeData,
  isFileChangePartFailed
} from '../utils/workspace-message-parts.util'
import type { WorkspaceChangeEntry } from '@baishou/shared'
import styles from './AgentWorkspaceMessageList.module.css'

export interface AgentWorkspaceMessageListProps {
  sessionId?: string
  messages: WorkspaceChatMessage[]
  pendingAssistantMsg?: PendingWorkspaceAssistantMsg | null
  streamingText?: string
  streamingReasoning?: string
  isStreaming?: boolean
  streamError?: string | null
  activeToolName?: string | null
  completedTools?: Array<{ name: string; durationMs: number; error?: string }>
  failedTools?: WorkspaceToolError[]
  assistantProfile?: {
    name: string
    avatarPath?: string | null
    emoji?: string | null
  }
  onRollbackRound?: (userMessageId: string) => void
  onChangesUpdate?: (changes: WorkspaceChangeEntry[]) => void
}

export const AgentWorkspaceMessageList: React.FC<AgentWorkspaceMessageListProps> = ({
  sessionId,
  messages,
  pendingAssistantMsg,
  streamingText = '',
  streamingReasoning = '',
  isStreaming = false,
  streamError = null,
  activeToolName = null,
  completedTools = [],
  failedTools = [],
  assistantProfile,
  onRollbackRound,
  onChangesUpdate
}) => {
  const { t } = useTranslation()

  const syncChanges = useCallback(
    (list: WorkspaceChatMessage[]) => {
      onChangesUpdate?.(collectWorkspaceFileChanges(list))
    },
    [onChangesUpdate]
  )

  useEffect(() => {
    syncChanges(messages)
  }, [messages, syncChanges])

  if (!sessionId || sessionId === 'new-session') {
    return null
  }

  const activeToolDisplayName = activeToolName ? formatWorkspaceToolDisplayName(activeToolName) : null

  const streamingCompletedTools = [
    ...completedTools.map((tool) => ({
      name: formatWorkspaceToolDisplayName(tool.name),
      durationMs: tool.durationMs,
      error: tool.error
    })),
    ...failedTools.map((tool) => ({
      name: formatWorkspaceToolDisplayName(tool.name),
      durationMs: 0,
      error: tool.error
    }))
  ]

  return (
    <div className={styles.list}>
      {messages.map((msg) => {
        if (msg.role === 'user') {
          const userText = getWorkspaceUserText(msg)
          return (
            <div key={msg.id} className={styles.userRow}>
              <div className={styles.userHeader}>
                <div className={styles.userBubble}>
                  {userText ? <p>{userText}</p> : null}
                </div>
                {onRollbackRound ? (
                  <button
                    type="button"
                    className={styles.rollbackBtn}
                    onClick={() => onRollbackRound(msg.id)}
                  >
                    {t('round_rollback.action', '回滚本轮')}
                  </button>
                ) : null}
              </div>
            </div>
          )
        }

        const assistantText = getWorkspaceAssistantText(msg)
        const assistantReasoning = getWorkspaceAssistantReasoning(msg)
        const toolInvocations = extractToolInvocations(msg.parts)
        const fileChangeParts = (msg.parts ?? []).filter(
          (part) => part.type === 'file_change' && isFileChangeData(part.data)
        )

        return (
          <div key={msg.id} className={styles.assistantRow}>
            <div className={styles.assistantBlock}>
              {assistantReasoning ? (
                <div className={styles.assistantReasoning}>{assistantReasoning}</div>
              ) : null}
              {assistantText ? (
                <div className={styles.assistantBubble}>{assistantText}</div>
              ) : null}
              {toolInvocations.length > 0 ? <ToolResultGroup invocations={toolInvocations} /> : null}
              {fileChangeParts.map((part, index) => {
                const data = part.data as FileChangePartData
                if (isFileChangePartFailed(data)) {
                  return (
                    <div key={`${msg.id}-fc-err-${index}`} className={styles.fileChangeError}>
                      {t('file_change.failed', '文件变更失败')}: {data.path}
                    </div>
                  )
                }
                return (
                  <FileChangeCard key={`${msg.id}-fc-${index}`} data={data} />
                )
              })}
            </div>
          </div>
        )
      })}

      {isStreaming ? (
        <div className={styles.assistantRow}>
          <StreamingBubble
            text={streamingText}
            reasoning={streamingReasoning}
            isReasoning={Boolean(streamingReasoning && !streamingText)}
            activeToolName={activeToolDisplayName}
            completedTools={streamingCompletedTools.filter((tool) => !tool.error)}
            aiProfile={assistantProfile ?? { name: 'AI' }}
            error={streamError}
          />
          {failedTools.length > 0 || streamingCompletedTools.some((tool) => tool.error) ? (
            <ul className={styles.streamToolErrors}>
              {[
                ...failedTools.map((tool) => ({
                  name: formatWorkspaceToolDisplayName(tool.name),
                  error: tool.error
                })),
                ...streamingCompletedTools
                  .filter((tool) => tool.error)
                  .map((tool) => ({ name: tool.name, error: tool.error! }))
              ].map((tool, index) => (
                <li key={`${tool.name}-stream-err-${index}`}>
                  {tool.name}: {tool.error}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {!isStreaming && pendingAssistantMsg ? (
        <div className={styles.assistantRow}>
          <div className={styles.assistantBlock}>
            {pendingAssistantMsg.reasoning ? (
              <div className={styles.assistantReasoning}>{pendingAssistantMsg.reasoning}</div>
            ) : null}
            {pendingAssistantMsg.content ? (
              <div className={styles.assistantBubble}>{pendingAssistantMsg.content}</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
