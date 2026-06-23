import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileChangeCard } from '@baishou/ui'
import type { FileChangePartData, WorkspaceChangeEntry } from '@baishou/shared'
import styles from './AgentWorkspaceMessageList.module.css'

interface MessagePart {
  type?: string
  data?: unknown
}

interface WorkspaceMessage {
  id: string
  role: string
  parts?: MessagePart[]
}

export interface AgentWorkspaceMessageListProps {
  sessionId?: string
  streamingText?: string
  isStreaming?: boolean
  onRollbackRound?: (userMessageId: string) => void
  onChangesUpdate?: (changes: WorkspaceChangeEntry[]) => void
}

function isFileChangeData(data: unknown): data is FileChangePartData {
  if (!data || typeof data !== 'object') return false
  const record = data as Record<string, unknown>
  return typeof record.path === 'string' && typeof record.kind === 'string'
}

export const AgentWorkspaceMessageList: React.FC<AgentWorkspaceMessageListProps> = ({
  sessionId,
  streamingText,
  isStreaming,
  onRollbackRound,
  onChangesUpdate
}) => {
  const { t } = useTranslation()
  const [messages, setMessages] = useState<WorkspaceMessage[]>([])

  const loadMessages = useCallback(async () => {
    if (!sessionId || sessionId === 'new-session') {
      setMessages([])
      onChangesUpdate?.([])
      return
    }
    const rows = (await window.api.getMessages(sessionId)) as WorkspaceMessage[]
    const list = Array.isArray(rows) ? [...rows].reverse() : []
    setMessages(list)

    const changes: WorkspaceChangeEntry[] = []
    for (const msg of list) {
      for (const part of msg.parts ?? []) {
        if (part.type === 'file_change' && isFileChangeData(part.data)) {
          changes.push({
            id: `${msg.id}:${part.data.path}`,
            path: part.data.path,
            kind: part.data.kind,
            additions: part.data.additions,
            deletions: part.data.deletions,
            data: part.data
          })
        }
      }
    }
    onChangesUpdate?.(changes)
  }, [onChangesUpdate, sessionId])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  useEffect(() => {
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: string }>).detail
      if (!detail?.sessionId || detail.sessionId !== sessionId) return
      void loadMessages()
    }
    window.addEventListener('baishou:workspace-messages-changed', onChanged)
    window.addEventListener('baishou:assistant-message-usage', onChanged)
    return () => {
      window.removeEventListener('baishou:workspace-messages-changed', onChanged)
      window.removeEventListener('baishou:assistant-message-usage', onChanged)
    }
  }, [loadMessages, sessionId])

  if (!sessionId || sessionId === 'new-session') {
    return null
  }

  return (
    <div className={styles.list}>
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={msg.role === 'user' ? styles.userRow : styles.assistantRow}
        >
          {msg.role === 'user' ? (
            <div className={styles.userHeader}>
              <div className={styles.userBubble}>
                {(msg.parts ?? [])
                  .filter((part) => part.type === 'text')
                  .map((part, index) => (
                    <p key={index}>{String((part.data as { text?: string })?.text ?? '')}</p>
                  ))}
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
          ) : (
            <div className={styles.assistantBlock}>
              {(msg.parts ?? [])
                .filter((part) => part.type === 'text')
                .map((part, index) => (
                  <div key={index} className={styles.assistantBubble}>
                    {String((part.data as { text?: string; isReasoning?: boolean })?.text ?? '')}
                  </div>
                ))}
              {(msg.parts ?? [])
                .filter((part) => part.type === 'file_change' && isFileChangeData(part.data))
                .map((part, index) => (
                  <FileChangeCard
                    key={`${msg.id}-fc-${index}`}
                    data={part.data as FileChangePartData}
                  />
                ))}
            </div>
          )}
        </div>
      ))}

      {isStreaming && streamingText ? (
        <div className={styles.assistantRow}>
          <div className={styles.assistantBubble}>{streamingText}</div>
        </div>
      ) : null}
    </div>
  )
}
