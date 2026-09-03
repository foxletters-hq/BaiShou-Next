import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentPart, MockChatAttachment, PromptFileRef } from '@baishou/shared'
import { clearStreamBridgeForSession } from '../../agent/hooks/agent-stream-session-store'
import {
  prependOlderWorkspaceMessages,
  WORKSPACE_MESSAGE_PAGE_SIZE,
  workspaceHasMoreMessages
} from '../utils/workspace-chat-pagination.util'

export interface WorkspaceChatMessage {
  id: string
  role: string
  content?: string
  reasoning?: string
  parts?: AgentPart[]
  attachments?: MockChatAttachment[]
  skillRefs?: Array<{ command: string; content: string }>
  fileRefs?: PromptFileRef[]
  createdAt?: Date | string
  inputTokens?: number
  outputTokens?: number
  cacheReadInputTokens?: number
  cacheWriteInputTokens?: number
}

export interface PendingWorkspaceAssistantMsg {
  id: string
  content: string
  reasoning?: string
}

async function fetchWorkspaceMessages(
  sessionId: string,
  limit: number,
  offset: number
): Promise<WorkspaceChatMessage[]> {
  const rows = (await window.electron.ipcRenderer.invoke(
    'agent:get-messages',
    sessionId,
    limit,
    offset,
    true
  )) as WorkspaceChatMessage[] | null
  return Array.isArray(rows) ? rows : []
}

function resetPagination(
  setMessages: (rows: WorkspaceChatMessage[]) => void,
  setHasMore: (value: boolean) => void,
  loadedFromEndRef: { current: number },
  hasMoreRef: { current: boolean }
) {
  setMessages([])
  setHasMore(false)
  loadedFromEndRef.current = 0
  hasMoreRef.current = false
}

export function useWorkspaceChatMessages(params: {
  sessionId?: string
  isStreaming: boolean
  streamingText: string
  streamingReasoning: string
}) {
  const { sessionId, isStreaming, streamingText, streamingReasoning } = params
  const [messages, setMessages] = useState<WorkspaceChatMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [pendingAssistantMsg, setPendingAssistantMsg] =
    useState<PendingWorkspaceAssistantMsg | null>(null)
  const streamSessionIdRef = useRef<string | null>(null)
  const sessionIdRef = useRef(sessionId)
  const loadedFromEndRef = useRef(0)
  const hasMoreRef = useRef(false)
  const loadMoreLockRef = useRef(false)
  const prevStreamingRef = useRef(isStreaming)
  sessionIdRef.current = sessionId

  const applyLatestPage = useCallback((rows: WorkspaceChatMessage[], requestedLimit: number) => {
    const nextHasMore = workspaceHasMoreMessages(rows.length, requestedLimit)
    setMessages(rows)
    loadedFromEndRef.current = rows.length
    hasMoreRef.current = nextHasMore
    setHasMore(nextHasMore)
  }, [])

  const refresh = useCallback(
    async (overrideSessionId?: string) => {
      const sid = overrideSessionId ?? sessionId
      if (!sid || sid === 'new-session') {
        resetPagination(setMessages, setHasMore, loadedFromEndRef, hasMoreRef)
        return false
      }
      const limit = Math.max(loadedFromEndRef.current, WORKSPACE_MESSAGE_PAGE_SIZE)
      const rows = await fetchWorkspaceMessages(sid, limit, 0)
      const stillCurrent =
        sessionIdRef.current === sid || streamSessionIdRef.current === sid
      if (!stillCurrent) return false
      applyLatestPage(rows, limit)
      return true
    },
    [applyLatestPage, sessionId]
  )

  const loadMore = useCallback(async () => {
    const sid = sessionId
    if (!sid || sid === 'new-session' || loadMoreLockRef.current || !hasMoreRef.current) return
    loadMoreLockRef.current = true
    try {
      const rows = await fetchWorkspaceMessages(
        sid,
        WORKSPACE_MESSAGE_PAGE_SIZE,
        loadedFromEndRef.current
      )
      if (sessionIdRef.current !== sid) return
      if (rows.length === 0) {
        hasMoreRef.current = false
        setHasMore(false)
        return
      }
      const nextHasMore = workspaceHasMoreMessages(rows.length, WORKSPACE_MESSAGE_PAGE_SIZE)
      setMessages((prev) => prependOlderWorkspaceMessages(prev, rows))
      loadedFromEndRef.current += rows.length
      hasMoreRef.current = nextHasMore
      setHasMore(nextHasMore)
    } finally {
      loadMoreLockRef.current = false
    }
  }, [sessionId])

  const setStreamSessionId = useCallback((sid: string | null) => {
    streamSessionIdRef.current = sid
  }, [])

  useEffect(() => {
    if (!sessionId || sessionId === 'new-session') {
      resetPagination(setMessages, setHasMore, loadedFromEndRef, hasMoreRef)
      return
    }
    resetPagination(setMessages, setHasMore, loadedFromEndRef, hasMoreRef)
    void refresh()
  }, [refresh, sessionId])

  useEffect(() => {
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: string }>).detail
      const eventSid = detail?.sessionId
      if (!eventSid) return
      const matchesRoute = Boolean(sessionId && eventSid === sessionId)
      const matchesStream = streamSessionIdRef.current === eventSid
      if (!matchesRoute && !matchesStream) return
      void refresh(eventSid)
    }
    window.addEventListener('baishou:workspace-messages-changed', onChanged)
    window.addEventListener('baishou:assistant-message-usage', onChanged)
    return () => {
      window.removeEventListener('baishou:workspace-messages-changed', onChanged)
      window.removeEventListener('baishou:assistant-message-usage', onChanged)
    }
  }, [refresh, sessionId])

  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming) {
      const sid = streamSessionIdRef.current || sessionId
      if (sid && sid !== 'new-session') {
        if (streamingText || streamingReasoning) {
          setPendingAssistantMsg({
            id: `pending-${Date.now()}`,
            content: streamingText,
            reasoning: streamingReasoning || undefined
          })
        }

        const sync = async () => {
          await new Promise((resolve) => setTimeout(resolve, 120))
          const ok = await refresh(sid)
          if (ok) {
            clearStreamBridgeForSession(sid)
            setPendingAssistantMsg(null)
          }
        }
        void sync()
      }
    }
    prevStreamingRef.current = isStreaming
  }, [isStreaming, sessionId, streamingReasoning, streamingText, refresh])

  return {
    messages,
    hasMore,
    pendingAssistantMsg,
    refresh,
    loadMore,
    setStreamSessionId
  }
}
