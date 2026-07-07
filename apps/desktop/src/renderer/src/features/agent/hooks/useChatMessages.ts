import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { CHAT_MESSAGE_FETCH_LIMIT, CHAT_TAIL_FETCH_LIMIT } from '../utils/chat-round-pagination'
import { clearStreamBridgeForSession } from './useAgentStream'
import {
  chatSessionMessageCache,
  type SessionMessageCacheEntry
} from '../utils/chat-session-message-cache'
import {
  type CompactionAnchor,
  resolveLatestCompactionAnchor,
  applyPendingUsageToMessages,
  mergeFetchedWithCache,
  mergeTailIntoCache,
  messageHasUsageStats,
  isViewingLatestRounds,
  resolveRoundWindowStart,
  applyCacheToWindow,
  buildSessionCacheSnapshot,
  fetchMessagesFromIpc
} from './useChatMessages.helpers'
import { useChatMessageMutations } from './useChatMessages.mutations'
import type { MockChatAttachment } from '@baishou/shared'

export type { CompactionAnchor } from './useChatMessages.helpers'

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
  refreshLatestMessages: (
    retryCount?: number,
    overrideSessionId?: string,
    options?: { resetPagination?: boolean }
  ) => Promise<boolean>
  appendSentUserMessage: (payload: {
    id: string
    content: string
    attachments?: MockChatAttachment[]
    createdAt?: Date
  }) => void
  optimisticRemove: (optimisticId: string) => void
  setStreamSessionId: (id: string | null) => void
  truncateMessages: (messageId: string, options?: { content?: string }) => void
  ensureMessageAttachments: (messageId: string, attachments: MockChatAttachment[]) => void
}

/** @deprecated 兼容旧测试引用；首屏按轮分页，不再按固定条数估算 */
/**
 * 消息生命周期管理 Hook (去乐观化版本)
 * 所有的状态更新均建立在数据库真实数据之上。
 * 展示层按「每 3 轮」隐藏分页，避免首屏渲染过多导致滚动卡顿。
 */
export function useChatMessages(params: UseChatMessagesParams): UseChatMessagesResult {
  const { sessionId, isStreaming } = params

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

  const hydrateFromSessionCache = useCallback(
    (cached: SessionMessageCacheEntry) => {
      messageCacheRef.current = [...cached.messages]
      loadedFromEndRef.current = cached.loadedFromEnd
      roundWindowStartRef.current = cached.roundWindowStart
      fetchHasMoreRef.current = cached.fetchHasMore
      setCompactionAnchor(cached.compactionAnchor)
      syncFromCache(cached.roundWindowStart)
    },
    [syncFromCache]
  )

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

      const start = resolveRoundWindowStart(
        messageCacheRef.current,
        roundWindowStartRef.current,
        preserveWindow
      )

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

      const start = resolveRoundWindowStart(
        messageCacheRef.current,
        roundWindowStartRef.current,
        preserveWindow
      )

      return syncFromCache(start)
    },
    [syncFromCache]
  )

  const refreshLatestMessages = useCallback(
    async (
      retryCount = 3,
      overrideSessionId?: string,
      options?: { resetPagination?: boolean }
    ): Promise<boolean> => {
      const targetId = overrideSessionId || sessionId
      if (!targetId) return false

      for (let attempt = 0; attempt < retryCount; attempt++) {
        try {
          const fetched = await fetchMessagesFromIpc(targetId, CHAT_TAIL_FETCH_LIMIT, 0)
          if (!fetched?.length) {
            if (attempt === retryCount - 1) return messageCacheRef.current.length > 0
            continue
          }

          const preserveWindow =
            !options?.resetPagination &&
            !isViewingLatestRounds(messageCacheRef.current, roundWindowStartRef.current)
          ingestTailMessages(fetched, preserveWindow)

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
            const preserveWindow = !isViewingLatestRounds(
              messageCacheRef.current,
              roundWindowStartRef.current
            )
            ingestFetchedTail(fetched, preserveWindow)

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

      const cached = chatSessionMessageCache.get(sessionId)
      if (cached?.messages?.length) {
        hydrateFromSessionCache(cached)
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
  }, [sessionId, ingestFetchedTail, persistSessionCache, hydrateFromSessionCache])

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

  const {
    loadMore,
    optimisticRemove,
    setStreamSessionId,
    ensureMessageAttachments,
    truncateMessages,
    appendSentUserMessage
  } = useChatMessageMutations({
    sessionId,
    messageCacheRef,
    roundWindowStartRef,
    fetchHasMoreRef,
    loadedFromEndRef,
    streamSessionIdRef,
    syncFromCache,
    persistSessionCache,
    ingestTailMessages,
    setMessages,
    setHasMore,
    setCompactionAnchor
  })

  return {
    messages,
    setMessages,
    hasMore,
    compactionAnchor,
    loadMore,
    refreshMessages,
    refreshLatestMessages,
    appendSentUserMessage,
    optimisticRemove,
    setStreamSessionId,
    truncateMessages,
    ensureMessageAttachments
  }
}
