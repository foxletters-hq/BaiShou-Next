import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import type { MockChatAttachment } from '@baishou/shared'
import {
  CHAT_MESSAGE_FETCH_LIMIT,
  CHAT_ROUNDS_PER_PAGE,
  CHAT_TAIL_FETCH_LIMIT,
  computeInitialRoundWindowStart,
  expandRoundWindowStart,
  flattenRoundSlice,
  groupMessagesIntoRounds
} from '../utils/chat-round-pagination'
import { clearStreamBridgeForSession } from './useAgentStream'
import {
  chatSessionMessageCache,
  type SessionMessageCacheEntry
} from '../utils/chat-session-message-cache'

export type CompactionAnchor = {
  messageId: string
  record: {
    streamTranscript?: string
    streamReasoning?: string
    phase?: 'auto' | 'manual'
    status?: 'completed' | 'failed'
    thoughtDurationMs?: number
    summaryDurationMs?: number
  }
}

function resolveLatestCompactionAnchor(messages: readonly any[]): CompactionAnchor | null {
  let best: CompactionAnchor | null = null
  let bestOrder = -1

  for (const msg of messages) {
    if (msg.role !== 'user' || !msg.compactionRecord) continue
    if (msg.compactionRecord.status === 'failed') continue
    const orderIndex = typeof msg.orderIndex === 'number' ? msg.orderIndex : bestOrder + 1
    if (orderIndex >= bestOrder) {
      bestOrder = orderIndex
      best = { messageId: msg.id, record: msg.compactionRecord }
    }
  }

  return best
}

export interface UseChatMessagesParams {
  sessionId: string | undefined
  isStreaming: boolean
  streamingText: string
  streamingReasoning: string
}

export interface UseChatMessagesResult {
  messages: any[]
  setMessages: React.Dispatch<React.SetStateAction<any[]>>
  hasMore: boolean
  compactionAnchor: CompactionAnchor | null
  loadMore: () => Promise<void>
  refreshMessages: (retryCount?: number, overrideSessionId?: string) => Promise<boolean>
  refreshLatestMessages: (retryCount?: number, overrideSessionId?: string) => Promise<boolean>
  optimisticRemove: (optimisticId: string) => void
  setStreamSessionId: (id: string | null) => void
  truncateMessages: (messageId: string, options?: { content?: string }) => void
  ensureMessageAttachments: (messageId: string, attachments: MockChatAttachment[]) => void
}

/** @deprecated 兼容旧测试引用；首屏按轮分页，不再按固定条数估算 */
export const CHAT_INITIAL_ROUND_BATCH = CHAT_ROUNDS_PER_PAGE
export const CHAT_INITIAL_MESSAGE_BATCH = CHAT_MESSAGE_FETCH_LIMIT

function resolveHasMore(roundWindowStart: number, fetchHasMore: boolean): boolean {
  return roundWindowStart > 0 || fetchHasMore
}

function mergeMessageTokenFields(prev: any | undefined, next: any): any {
  if (!prev) return next
  const nextHasUsage = messageHasUsageStats(next)
  const prevHasUsage = messageHasUsageStats(prev)
  if (nextHasUsage || !prevHasUsage) return next
  return {
    ...next,
    inputTokens: prev.inputTokens,
    outputTokens: prev.outputTokens,
    cacheReadInputTokens: prev.cacheReadInputTokens,
    cacheWriteInputTokens: prev.cacheWriteInputTokens,
    costMicros: prev.costMicros
  }
}

function mergeFetchedWithCache(prevCache: readonly any[], fetched: any[]): any[] {
  const prevById = new Map(prevCache.map((m) => [m.id, m]))
  return fetched.map((m) => mergeMessageTokenFields(prevById.get(m.id), m))
}

function mergeTailIntoCache(prevCache: readonly any[], tail: any[]): any[] {
  if (tail.length === 0) return [...prevCache]
  const tailIds = new Set(tail.map((m) => m.id))
  const kept = prevCache.filter((m) => !tailIds.has(m.id))
  return mergeFetchedWithCache(kept, [...kept, ...tail])
}

function messageHasUsageStats(msg: any): boolean {
  return (
    (msg.inputTokens ?? 0) > 0 ||
    (msg.outputTokens ?? 0) > 0 ||
    (msg.costMicros ?? 0) > 0 ||
    (msg.cacheReadInputTokens ?? 0) > 0 ||
    (msg.cacheWriteInputTokens ?? 0) > 0
  )
}

function applyPendingUsageToMessages(
  messages: any[],
  pendingUsage: Map<string, Record<string, number | undefined>>
): any[] {
  if (pendingUsage.size === 0) return messages
  return messages.map((msg) => {
    const usage = pendingUsage.get(msg.id)
    if (!usage || messageHasUsageStats(msg)) return msg
    return {
      ...msg,
      inputTokens: usage.inputTokens ?? msg.inputTokens,
      outputTokens: usage.outputTokens ?? msg.outputTokens,
      cacheReadInputTokens: usage.cacheReadInputTokens ?? msg.cacheReadInputTokens,
      cacheWriteInputTokens: usage.cacheWriteInputTokens ?? msg.cacheWriteInputTokens,
      costMicros: usage.costMicros ?? msg.costMicros
    }
  })
}

function applyCacheToWindow(
  cache: any[],
  roundWindowStart: number,
  fetchHasMore: boolean
): { display: any[]; hasMore: boolean; roundWindowStart: number } {
  const rounds = groupMessagesIntoRounds(cache)
  const clampedStart = Math.min(roundWindowStart, computeInitialRoundWindowStart(rounds.length))
  const display = flattenRoundSlice(rounds, clampedStart)
  return {
    display,
    hasMore: resolveHasMore(clampedStart, fetchHasMore),
    roundWindowStart: clampedStart
  }
}

function buildSessionCacheSnapshot(state: {
  messageCacheRef: { current: any[] }
  loadedFromEndRef: { current: number }
  roundWindowStartRef: { current: number }
  fetchHasMoreRef: { current: boolean }
  compactionAnchor: CompactionAnchor | null
}): SessionMessageCacheEntry {
  return {
    messages: [...state.messageCacheRef.current],
    loadedFromEnd: state.loadedFromEndRef.current,
    roundWindowStart: state.roundWindowStartRef.current,
    fetchHasMore: state.fetchHasMoreRef.current,
    compactionAnchor: state.compactionAnchor
  }
}

async function fetchMessagesFromIpc(
  sessionId: string,
  limit: number,
  offset: number
): Promise<any[] | null> {
  const fetched = await window.electron.ipcRenderer.invoke(
    'agent:get-messages',
    sessionId,
    limit,
    offset,
    false
  )
  return fetched ?? null
}

/**
 * 消息生命周期管理 Hook (去乐观化版本)
 * 所有的状态更新均建立在数据库真实数据之上。
 * 展示层按「每 3 轮」隐藏分页，避免首屏渲染过多导致滚动卡顿。
 */
export function useChatMessages(params: UseChatMessagesParams): UseChatMessagesResult {
  const { sessionId, isStreaming, streamingText, streamingReasoning } = params

  const [messages, setMessages] = useState<any[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [compactionAnchor, setCompactionAnchor] = useState<CompactionAnchor | null>(null)
  const currentSessionIdRef = useRef<string | null>(null)
  const streamSessionIdRef = useRef<string | null>(null)
  const loadedFromEndRef = useRef(0)
  const messageCacheRef = useRef<any[]>([])
  const roundWindowStartRef = useRef(0)
  const fetchHasMoreRef = useRef(false)
  const pendingUsageByMessageIdRef = useRef(new Map<string, Record<string, number | undefined>>())
  const compactionAnchorRef = useRef<CompactionAnchor | null>(null)

  useEffect(() => {
    compactionAnchorRef.current = compactionAnchor
  }, [compactionAnchor])

  const messagesRef = useRef<any[]>(messages)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const persistSessionCache = useCallback((targetSessionId: string) => {
    if (!targetSessionId || messageCacheRef.current.length === 0) return
    chatSessionMessageCache.set(
      targetSessionId,
      buildSessionCacheSnapshot({
        messageCacheRef,
        loadedFromEndRef,
        roundWindowStartRef,
        fetchHasMoreRef,
        compactionAnchor: compactionAnchorRef.current
      })
    )
  }, [])

  const syncFromCache = useCallback((roundWindowStart: number) => {
    const result = applyCacheToWindow(
      messageCacheRef.current,
      roundWindowStart,
      fetchHasMoreRef.current
    )
    roundWindowStartRef.current = result.roundWindowStart
    setMessages(result.display)
    setHasMore(result.hasMore)
    return result
  }, [])

  const ingestFetchedTail = useCallback(
    (fetched: any[], preserveWindow: boolean) => {
      messageCacheRef.current = applyPendingUsageToMessages(
        mergeFetchedWithCache(messageCacheRef.current, fetched),
        pendingUsageByMessageIdRef.current
      )
      for (const msg of messageCacheRef.current) {
        if (messageHasUsageStats(msg)) {
          pendingUsageByMessageIdRef.current.delete(msg.id)
        }
      }
      loadedFromEndRef.current = fetched.length
      fetchHasMoreRef.current = fetched.length >= CHAT_MESSAGE_FETCH_LIMIT
      setCompactionAnchor(resolveLatestCompactionAnchor(fetched))

      const rounds = groupMessagesIntoRounds(fetched)
      let start = roundWindowStartRef.current

      if (!preserveWindow || start >= Math.max(0, rounds.length - CHAT_ROUNDS_PER_PAGE)) {
        start = computeInitialRoundWindowStart(rounds.length)
      } else {
        start = Math.min(start, computeInitialRoundWindowStart(rounds.length))
      }

      return syncFromCache(start)
    },
    [syncFromCache]
  )

  const ingestTailMessages = useCallback(
    (tail: any[], preserveWindow: boolean) => {
      const prevLength = messageCacheRef.current.length
      messageCacheRef.current = applyPendingUsageToMessages(
        mergeTailIntoCache(messageCacheRef.current, tail),
        pendingUsageByMessageIdRef.current
      )
      for (const msg of messageCacheRef.current) {
        if (messageHasUsageStats(msg)) {
          pendingUsageByMessageIdRef.current.delete(msg.id)
        }
      }

      const addedCount = messageCacheRef.current.length - prevLength
      if (addedCount > 0) {
        loadedFromEndRef.current += addedCount
      }

      setCompactionAnchor(resolveLatestCompactionAnchor(messageCacheRef.current))

      const rounds = groupMessagesIntoRounds(messageCacheRef.current)
      let start = roundWindowStartRef.current
      if (!preserveWindow || start >= Math.max(0, rounds.length - CHAT_ROUNDS_PER_PAGE)) {
        start = computeInitialRoundWindowStart(rounds.length)
      } else {
        start = Math.min(start, computeInitialRoundWindowStart(rounds.length))
      }

      return syncFromCache(start)
    },
    [syncFromCache]
  )

  const restoreSessionCache = useCallback(
    (targetSessionId: string): boolean => {
      const cached = chatSessionMessageCache.get(targetSessionId)
      if (!cached) return false

      messageCacheRef.current = applyPendingUsageToMessages(
        [...cached.messages],
        pendingUsageByMessageIdRef.current
      )
      loadedFromEndRef.current = cached.loadedFromEnd
      roundWindowStartRef.current = cached.roundWindowStart
      fetchHasMoreRef.current = cached.fetchHasMore
      setCompactionAnchor(cached.compactionAnchor)
      syncFromCache(cached.roundWindowStart)
      return true
    },
    [syncFromCache]
  )

  const refreshLatestMessages = useCallback(
    async (retryCount = 3, overrideSessionId?: string): Promise<boolean> => {
      const targetId = overrideSessionId || sessionId
      if (!targetId) return false

      for (let attempt = 0; attempt < retryCount; attempt++) {
        try {
          const fetched = await fetchMessagesFromIpc(targetId, CHAT_TAIL_FETCH_LIMIT, 0)
          if (!fetched?.length) {
            if (attempt === retryCount - 1) return messageCacheRef.current.length > 0
            continue
          }

          const atBottom =
            roundWindowStartRef.current >=
            Math.max(
              0,
              groupMessagesIntoRounds(messageCacheRef.current).length - CHAT_ROUNDS_PER_PAGE
            )
          ingestTailMessages(fetched, !atBottom)

          const latestAssistant = [...fetched].reverse().find((m) => m.role === 'assistant')
          if (
            latestAssistant &&
            !messageHasUsageStats(latestAssistant) &&
            attempt < retryCount - 1
          ) {
            await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
            continue
          }

          return true
        } catch (e) {
          console.warn('[useChatMessages] refreshLatestMessages attempt', attempt + 1, 'failed:', e)
        }
        if (attempt < retryCount - 1) {
          await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
        }
      }
      return false
    },
    [sessionId, ingestTailMessages]
  )

  const refreshMessages = useCallback(
    async (retryCount = 1, overrideSessionId?: string): Promise<boolean> => {
      const targetId = overrideSessionId || sessionId
      if (!targetId) return false

      for (let attempt = 0; attempt < retryCount; attempt++) {
        try {
          const fetchLimit = Math.max(loadedFromEndRef.current, CHAT_MESSAGE_FETCH_LIMIT)

          const fetched = await fetchMessagesFromIpc(targetId, fetchLimit, 0)

          if (fetched) {
            const atBottom =
              roundWindowStartRef.current >=
              Math.max(
                0,
                groupMessagesIntoRounds(messageCacheRef.current).length - CHAT_ROUNDS_PER_PAGE
              )
            ingestFetchedTail(fetched, !atBottom)

            const latestAssistant = [...fetched].reverse().find((m) => m.role === 'assistant')
            if (
              latestAssistant &&
              !messageHasUsageStats(latestAssistant) &&
              attempt < retryCount - 1
            ) {
              await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
              continue
            }

            return true
          }
        } catch (e) {
          console.warn('[useChatMessages] refreshMessages attempt', attempt + 1, 'failed:', e)
        }
        if (attempt < retryCount - 1) {
          await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
        }
      }
      return false
    },
    [sessionId, ingestFetchedTail]
  )

  useLayoutEffect(() => {
    if (!sessionId) {
      if (currentSessionIdRef.current) {
        persistSessionCache(currentSessionIdRef.current)
      }
      setMessages([])
      setHasMore(false)
      loadedFromEndRef.current = 0
      messageCacheRef.current = []
      roundWindowStartRef.current = 0
      fetchHasMoreRef.current = false
      pendingUsageByMessageIdRef.current.clear()
      setCompactionAnchor(null)
      currentSessionIdRef.current = null
      return
    }

    if (sessionId !== currentSessionIdRef.current) {
      const previousSessionId = currentSessionIdRef.current
      if (previousSessionId) {
        persistSessionCache(previousSessionId)
      }

      currentSessionIdRef.current = sessionId
      pendingUsageByMessageIdRef.current.clear()

      const restored = restoreSessionCache(sessionId)
      if (restored) {
        void refreshLatestMessages(1)
        return
      }

      setMessages([])
      setHasMore(false)
      loadedFromEndRef.current = 0
      messageCacheRef.current = []
      roundWindowStartRef.current = 0
      fetchHasMoreRef.current = false
      setCompactionAnchor(null)

      const loadMessages = async () => {
        if (currentSessionIdRef.current !== sessionId) return
        try {
          const fetched = await fetchMessagesFromIpc(sessionId, CHAT_MESSAGE_FETCH_LIMIT, 0)
          if (currentSessionIdRef.current !== sessionId) return
          if (fetched) {
            ingestFetchedTail(fetched, false)
          }
        } catch (e) {
          if (currentSessionIdRef.current !== sessionId) return
          console.error('[useChatMessages] DB fetch error:', e)
          setMessages([])
          setHasMore(false)
          loadedFromEndRef.current = 0
          messageCacheRef.current = []
          roundWindowStartRef.current = 0
          fetchHasMoreRef.current = false
        }
      }
      void loadMessages()
    }
  }, [
    sessionId,
    ingestFetchedTail,
    persistSessionCache,
    restoreSessionCache,
    refreshLatestMessages
  ])

  useEffect(() => {
    if (!sessionId) return

    const onAssistantUsage = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          sessionId?: string
          messageId?: string
          inputTokens?: number
          outputTokens?: number
          cacheReadInputTokens?: number
          cacheWriteInputTokens?: number
          costMicros?: number
        }>
      ).detail
      if (!detail?.sessionId || detail.sessionId !== sessionId || !detail.messageId) return

      pendingUsageByMessageIdRef.current.set(detail.messageId, {
        inputTokens: detail.inputTokens,
        outputTokens: detail.outputTokens,
        cacheReadInputTokens: detail.cacheReadInputTokens,
        cacheWriteInputTokens: detail.cacheWriteInputTokens,
        costMicros: detail.costMicros
      })

      const patch = (msg: any) => {
        if (msg.id !== detail.messageId) return msg
        return {
          ...msg,
          inputTokens: detail.inputTokens ?? msg.inputTokens,
          outputTokens: detail.outputTokens ?? msg.outputTokens,
          cacheReadInputTokens: detail.cacheReadInputTokens ?? msg.cacheReadInputTokens,
          cacheWriteInputTokens: detail.cacheWriteInputTokens ?? msg.cacheWriteInputTokens,
          costMicros: detail.costMicros ?? msg.costMicros
        }
      }

      messageCacheRef.current = messageCacheRef.current.map(patch)
      if (
        messageCacheRef.current.some((m) => m.id === detail.messageId && messageHasUsageStats(m))
      ) {
        pendingUsageByMessageIdRef.current.delete(detail.messageId)
      }
      syncFromCache(roundWindowStartRef.current)

      window.dispatchEvent(
        new CustomEvent('baishou:session-token-usage-changed', {
          detail: { sessionId }
        })
      )
    }

    window.addEventListener('baishou:assistant-message-usage', onAssistantUsage)
    return () => window.removeEventListener('baishou:assistant-message-usage', onAssistantUsage)
  }, [sessionId, syncFromCache])

  useEffect(() => {
    if (!sessionId) return

    const onCompressionFinished = (e: Event) => {
      const detail = (e as CustomEvent<{ sessionId?: string }>).detail
      if (detail?.sessionId && detail.sessionId !== sessionId) return
      chatSessionMessageCache.delete(sessionId)
      void refreshMessages(5).then((ok) => {
        if (ok) {
          window.dispatchEvent(
            new CustomEvent('baishou:compression-stream-reset', {
              detail: { sessionId: detail?.sessionId ?? sessionId }
            })
          )
        }
      })
    }

    window.addEventListener('baishou:compression-finished', onCompressionFinished)
    return () => window.removeEventListener('baishou:compression-finished', onCompressionFinished)
  }, [sessionId, refreshMessages])

  useEffect(() => {
    if (!sessionId || typeof window === 'undefined' || !window.electron) return undefined

    const onSessionFileChanged = () => {
      if (isStreaming) return
      chatSessionMessageCache.delete(sessionId)
      void refreshMessages(3)
    }

    const removeListener = window.electron.ipcRenderer.on(
      'session:file-changed',
      onSessionFileChanged
    )
    return () => removeListener()
  }, [sessionId, isStreaming, refreshMessages])

  const prevStreamingRef = useRef(isStreaming)
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming && sessionId) {
      if (streamSessionIdRef.current !== sessionId) {
        prevStreamingRef.current = isStreaming
        return
      }

      const sync = async () => {
        const success = await refreshLatestMessages(3)
        if (success && sessionId) {
          persistSessionCache(sessionId)
          clearStreamBridgeForSession(sessionId)
        }
      }
      void sync()
    }
    prevStreamingRef.current = isStreaming
  }, [isStreaming, sessionId, refreshLatestMessages, persistSessionCache])

  const loadMore = useCallback(async () => {
    if (!sessionId) return

    if (roundWindowStartRef.current > 0) {
      roundWindowStartRef.current = expandRoundWindowStart(roundWindowStartRef.current)
      syncFromCache(roundWindowStartRef.current)
      return
    }

    if (!fetchHasMoreRef.current) {
      setHasMore(false)
      return
    }

    try {
      const fetched = await fetchMessagesFromIpc(
        sessionId,
        CHAT_MESSAGE_FETCH_LIMIT,
        loadedFromEndRef.current
      )
      if (!fetched?.length) {
        fetchHasMoreRef.current = false
        setHasMore(false)
        return
      }

      fetchHasMoreRef.current = fetched.length >= CHAT_MESSAGE_FETCH_LIMIT
      loadedFromEndRef.current += fetched.length

      const oldStart = roundWindowStartRef.current
      const prependedRoundCount = groupMessagesIntoRounds(fetched).length
      messageCacheRef.current = [...fetched, ...messageCacheRef.current]

      roundWindowStartRef.current = Math.max(
        0,
        oldStart + prependedRoundCount - CHAT_ROUNDS_PER_PAGE
      )
      syncFromCache(roundWindowStartRef.current)
      persistSessionCache(sessionId)
    } catch (e) {
      console.warn('[useChatMessages] loadMore failed:', e)
    }
  }, [sessionId, syncFromCache, persistSessionCache])

  const optimisticRemove = useCallback(
    (id: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== id))
      messageCacheRef.current = messageCacheRef.current.filter((m) => m.id !== id)
      if (sessionId) {
        chatSessionMessageCache.delete(sessionId)
      }
    },
    [sessionId]
  )

  const setStreamSessionId = useCallback((id: string | null) => {
    streamSessionIdRef.current = id
  }, [])

  const ensureMessageAttachments = useCallback(
    (messageId: string, attachments: MockChatAttachment[]) => {
      if (!attachments.length) return

      const patch = (msg: any) => {
        if (msg.id !== messageId) return msg
        if (msg.attachments?.length) return msg
        return { ...msg, attachments }
      }

      messageCacheRef.current = messageCacheRef.current.map(patch)
      setMessages((prev) => prev.map(patch))
    },
    []
  )

  const truncateMessages = useCallback(
    (messageId: string, options?: { content?: string }) => {
      const idx = messageCacheRef.current.findIndex((m) => m.id === messageId)
      if (idx === -1) return

      const truncated = messageCacheRef.current.slice(0, idx + 1).map((m, i) => {
        if (i < idx) return m
        const trimmedContent = options?.content?.trim()
        return {
          ...m,
          ...(trimmedContent ? { content: trimmedContent } : {}),
          compactionRecord: undefined,
          hasCompactionMarker: false
        }
      })
      messageCacheRef.current = truncated
      loadedFromEndRef.current = truncated.length

      const newAnchor = resolveLatestCompactionAnchor(truncated)
      setCompactionAnchor(newAnchor)

      syncFromCache(roundWindowStartRef.current)
      if (sessionId) {
        chatSessionMessageCache.delete(sessionId)
      }
    },
    [sessionId, syncFromCache]
  )

  return {
    messages,
    setMessages,
    hasMore,
    compactionAnchor,
    loadMore,
    refreshMessages,
    refreshLatestMessages,
    optimisticRemove,
    setStreamSessionId,
    truncateMessages,
    ensureMessageAttachments
  }
}
