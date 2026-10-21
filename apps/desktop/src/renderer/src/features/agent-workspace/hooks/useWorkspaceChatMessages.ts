import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentPart, MockChatAttachment, PromptFileRef } from '@baishou/shared'
import { clearStreamBridgeForSession } from '../../agent/hooks/agent-stream-session-store'
import { hasPersistedAssistantTail } from '../utils/workspace-persisted-assistant.util'
import {
  applyWorkspaceCacheToRoundWindow,
  cacheNeedsMoreForRoundWindow,
  enrichCacheForRoundWindow,
  groupMessagesIntoRounds,
  isViewingLatestWorkspaceRounds,
  resolveWorkspaceRoundWindowStart,
  WORKSPACE_MESSAGE_PAGE_SIZE,
  WORKSPACE_ROUNDS_PER_PAGE,
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
  streamStatus?: 'in_progress'
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
  messageCacheRef: { current: WorkspaceChatMessage[] },
  roundWindowStartRef: { current: number },
  loadedFromEndRef: { current: number },
  fetchHasMoreRef: { current: boolean },
  hasMoreRef: { current: boolean }
) {
  setMessages([])
  setHasMore(false)
  messageCacheRef.current = []
  roundWindowStartRef.current = 0
  loadedFromEndRef.current = 0
  fetchHasMoreRef.current = false
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
  const messageCacheRef = useRef<WorkspaceChatMessage[]>([])
  const roundWindowStartRef = useRef(0)
  const loadedFromEndRef = useRef(0)
  const fetchHasMoreRef = useRef(false)
  const hasMoreRef = useRef(false)
  const loadMoreLockRef = useRef(false)
  const prevStreamingRef = useRef(isStreaming)
  sessionIdRef.current = sessionId

  const syncFromCache = useCallback((roundWindowStart: number) => {
    const result = applyWorkspaceCacheToRoundWindow(
      messageCacheRef.current,
      roundWindowStart,
      fetchHasMoreRef.current
    )
    roundWindowStartRef.current = result.roundWindowStart
    hasMoreRef.current = result.hasMore
    setMessages(result.display)
    setHasMore(result.hasMore)
    return result
  }, [])

  const refresh = useCallback(
    async (overrideSessionId?: string): Promise<WorkspaceChatMessage[] | null> => {
      const sid = overrideSessionId ?? sessionId
      if (!sid || sid === 'new-session') {
        resetPagination(
          setMessages,
          setHasMore,
          messageCacheRef,
          roundWindowStartRef,
          loadedFromEndRef,
          fetchHasMoreRef,
          hasMoreRef
        )
        return null
      }
      const limit = Math.max(loadedFromEndRef.current, WORKSPACE_MESSAGE_PAGE_SIZE)
      const rows = await fetchWorkspaceMessages(sid, limit, 0)
      const isStillCurrent = () =>
        sessionIdRef.current === sid || streamSessionIdRef.current === sid
      if (!isStillCurrent()) return null

      const preserveWindow =
        messageCacheRef.current.length > 0 &&
        !isViewingLatestWorkspaceRounds(messageCacheRef.current, roundWindowStartRef.current)
      const prevTotalRounds = groupMessagesIntoRounds(messageCacheRef.current).length
      const targetVisibleRounds = preserveWindow
        ? Math.max(WORKSPACE_ROUNDS_PER_PAGE, prevTotalRounds - roundWindowStartRef.current)
        : WORKSPACE_ROUNDS_PER_PAGE

      const enriched = await enrichCacheForRoundWindow({
        cache: rows,
        loadedFromEnd: rows.length,
        fetchHasMore: workspaceHasMoreMessages(rows.length, limit),
        targetVisibleRounds,
        fetchPage: (pageLimit, pageOffset) => fetchWorkspaceMessages(sid, pageLimit, pageOffset),
        isCurrent: isStillCurrent,
        pageLimit: WORKSPACE_MESSAGE_PAGE_SIZE
      })
      if (!isStillCurrent()) return null

      messageCacheRef.current = enriched.cache
      loadedFromEndRef.current = enriched.loadedFromEnd
      fetchHasMoreRef.current = enriched.fetchHasMore

      const nextStart = preserveWindow
        ? Math.max(
            0,
            groupMessagesIntoRounds(enriched.cache).length - targetVisibleRounds
          )
        : resolveWorkspaceRoundWindowStart(enriched.cache, roundWindowStartRef.current, false)

      const applied = syncFromCache(nextStart)
      return applied.display
    },
    [sessionId, syncFromCache]
  )

  const loadMore = useCallback(async () => {
    const sid = sessionId
    if (!sid || sid === 'new-session' || loadMoreLockRef.current || !hasMoreRef.current) return
    loadMoreLockRef.current = true
    try {
      const currentRounds = groupMessagesIntoRounds(messageCacheRef.current)
      const currentVisibleRounds = Math.max(
        WORKSPACE_ROUNDS_PER_PAGE,
        currentRounds.length - roundWindowStartRef.current
      )
      const targetVisibleRounds = currentVisibleRounds + WORKSPACE_ROUNDS_PER_PAGE

      if (
        !cacheNeedsMoreForRoundWindow(
          messageCacheRef.current,
          targetVisibleRounds,
          fetchHasMoreRef.current
        )
      ) {
        if (roundWindowStartRef.current > 0) {
          const nextStart = Math.max(0, currentRounds.length - targetVisibleRounds)
          syncFromCache(nextStart)
        } else {
          hasMoreRef.current = false
          setHasMore(false)
        }
        return
      }

      const enriched = await enrichCacheForRoundWindow({
        cache: messageCacheRef.current,
        loadedFromEnd: loadedFromEndRef.current,
        fetchHasMore: fetchHasMoreRef.current,
        targetVisibleRounds,
        fetchPage: (pageLimit, pageOffset) => fetchWorkspaceMessages(sid, pageLimit, pageOffset),
        isCurrent: () => sessionIdRef.current === sid,
        pageLimit: WORKSPACE_MESSAGE_PAGE_SIZE
      })
      if (sessionIdRef.current !== sid) return
      if (
        enriched.loadedFromEnd === loadedFromEndRef.current &&
        !enriched.fetchHasMore &&
        roundWindowStartRef.current === 0
      ) {
        fetchHasMoreRef.current = false
        hasMoreRef.current = false
        setHasMore(false)
        return
      }

      messageCacheRef.current = enriched.cache
      loadedFromEndRef.current = enriched.loadedFromEnd
      fetchHasMoreRef.current = enriched.fetchHasMore

      const nextRounds = groupMessagesIntoRounds(enriched.cache)
      const nextStart = Math.max(0, nextRounds.length - targetVisibleRounds)
      syncFromCache(nextStart)
    } finally {
      loadMoreLockRef.current = false
    }
  }, [sessionId, syncFromCache])

  const setStreamSessionId = useCallback((sid: string | null) => {
    streamSessionIdRef.current = sid
  }, [])

  useEffect(() => {
    if (!sessionId || sessionId === 'new-session') {
      resetPagination(
        setMessages,
        setHasMore,
        messageCacheRef,
        roundWindowStartRef,
        loadedFromEndRef,
        fetchHasMoreRef,
        hasMoreRef
      )
      return
    }
    resetPagination(
      setMessages,
      setHasMore,
      messageCacheRef,
      roundWindowStartRef,
      loadedFromEndRef,
      fetchHasMoreRef,
      hasMoreRef
    )
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
    window.addEventListener('baishou:agent-stream-finished', onChanged)
    return () => {
      window.removeEventListener('baishou:workspace-messages-changed', onChanged)
      window.removeEventListener('baishou:assistant-message-usage', onChanged)
      window.removeEventListener('baishou:agent-stream-finished', onChanged)
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
          for (let attempt = 0; attempt < 5; attempt++) {
            if (attempt > 0) {
              await new Promise((resolve) => setTimeout(resolve, 150 * attempt))
            }
            const rows = await refresh(sid)
            if (!rows) continue
            if (hasPersistedAssistantTail(rows)) {
              clearStreamBridgeForSession(sid)
              setPendingAssistantMsg(null)
              return
            }
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
