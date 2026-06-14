import { useState, useRef, useEffect, useCallback } from 'react'
import type { MockChatAttachment } from '@baishou/shared'
import { clearChatAttachmentImageCaches } from '@baishou/ui/web/ChatBubble/chat-attachment-thumbnail.util'
import {
  CHAT_MESSAGE_FETCH_LIMIT,
  CHAT_ROUNDS_PER_PAGE,
  computeInitialRoundWindowStart,
  expandRoundWindowStart,
  flattenRoundSlice,
  groupMessagesIntoRounds
} from '../utils/chat-round-pagination'

export interface PendingAssistantMsg {
  id: string
  content: string
  reasoning?: string
  toolInvocations?: any[]
}

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
  pendingAssistantMsg: PendingAssistantMsg | null
  compactionAnchor: CompactionAnchor | null
  loadMore: () => Promise<void>
  refreshMessages: (retryCount?: number, overrideSessionId?: string) => Promise<boolean>
  optimisticRemove: (optimisticId: string) => void
  setStreamSessionId: (id: string | null) => void
  truncateMessages: (messageId: string) => void
  ensureMessageAttachments: (messageId: string, attachments: MockChatAttachment[]) => void
}

/** @deprecated 兼容旧测试引用；首屏按轮分页，不再按固定条数估算 */
export const CHAT_INITIAL_ROUND_BATCH = CHAT_ROUNDS_PER_PAGE
export const CHAT_INITIAL_MESSAGE_BATCH = CHAT_MESSAGE_FETCH_LIMIT

function resolveHasMore(roundWindowStart: number, fetchHasMore: boolean): boolean {
  return roundWindowStart > 0 || fetchHasMore
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

/**
 * 消息生命周期管理 Hook (去乐观化版本)
 * 所有的状态更新均建立在数据库真实数据之上。
 * 展示层按「每 3 轮」隐藏分页，避免首屏渲染过多导致滚动卡顿。
 */
export function useChatMessages(params: UseChatMessagesParams): UseChatMessagesResult {
  const { sessionId, isStreaming, streamingText, streamingReasoning } = params

  const [messages, setMessages] = useState<any[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [pendingAssistantMsg, setPendingAssistantMsg] = useState<PendingAssistantMsg | null>(null)
  const [compactionAnchor, setCompactionAnchor] = useState<CompactionAnchor | null>(null)
  const currentSessionIdRef = useRef<string | null>(null)
  const streamSessionIdRef = useRef<string | null>(null)
  const loadedFromEndRef = useRef(0)
  const messageCacheRef = useRef<any[]>([])
  const roundWindowStartRef = useRef(0)
  const fetchHasMoreRef = useRef(false)

  const messagesRef = useRef<any[]>(messages)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

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
      messageCacheRef.current = fetched
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

  const refreshMessages = useCallback(
    async (retryCount = 1, overrideSessionId?: string): Promise<boolean> => {
      const targetId = overrideSessionId || sessionId
      if (!targetId) return false

      for (let attempt = 0; attempt < retryCount; attempt++) {
        try {
          const fetchLimit = Math.max(loadedFromEndRef.current, CHAT_MESSAGE_FETCH_LIMIT)

          const fetched = await window.electron.ipcRenderer.invoke(
            'agent:get-messages',
            targetId,
            fetchLimit,
            0
          )

          if (fetched) {
            const atBottom =
              roundWindowStartRef.current >=
              Math.max(
                0,
                groupMessagesIntoRounds(messageCacheRef.current).length - CHAT_ROUNDS_PER_PAGE
              )
            ingestFetchedTail(fetched, !atBottom)
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

  useEffect(() => {
    if (!sessionId) {
      setMessages([])
      setHasMore(false)
      loadedFromEndRef.current = 0
      messageCacheRef.current = []
      roundWindowStartRef.current = 0
      fetchHasMoreRef.current = false
      setCompactionAnchor(null)
      currentSessionIdRef.current = null
      setPendingAssistantMsg(null)
      return
    }

    if (sessionId !== currentSessionIdRef.current) {
      currentSessionIdRef.current = sessionId
      clearChatAttachmentImageCaches()
      loadedFromEndRef.current = 0
      messageCacheRef.current = []
      roundWindowStartRef.current = 0
      fetchHasMoreRef.current = false

      const loadMessages = async () => {
        try {
          const fetched = await window.electron.ipcRenderer.invoke(
            'agent:get-messages',
            sessionId,
            CHAT_MESSAGE_FETCH_LIMIT,
            0
          )
          if (fetched) {
            ingestFetchedTail(fetched, false)
          }
        } catch (e) {
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
  }, [sessionId, ingestFetchedTail])

  useEffect(() => {
    if (!sessionId) return

    const onCompressionFinished = (e: Event) => {
      const detail = (e as CustomEvent<{ sessionId?: string }>).detail
      if (detail?.sessionId && detail.sessionId !== sessionId) return
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

  const prevStreamingRef = useRef(isStreaming)
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming && sessionId) {
      if (streamSessionIdRef.current === sessionId && (streamingText || streamingReasoning)) {
        setPendingAssistantMsg({
          id: `pending-${Date.now()}`,
          content: streamingText,
          reasoning: streamingReasoning || undefined
        })
      }

      const sync = async () => {
        await new Promise((r) => setTimeout(r, 100))
        const success = await refreshMessages(5)
        if (success) {
          setPendingAssistantMsg(null)
        } else {
          setPendingAssistantMsg(null)
        }
      }
      void sync()
    }
    prevStreamingRef.current = isStreaming
  }, [isStreaming, sessionId, streamingText, streamingReasoning, refreshMessages])

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
      const fetched = await window.electron.ipcRenderer.invoke(
        'agent:get-messages',
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
    } catch (e) {
      console.warn('[useChatMessages] loadMore failed:', e)
    }
  }, [sessionId, syncFromCache])

  const optimisticRemove = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id))
    messageCacheRef.current = messageCacheRef.current.filter((m) => m.id !== id)
  }, [])

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
    (messageId: string) => {
      const idx = messageCacheRef.current.findIndex((m) => m.id === messageId)
      if (idx === -1) return

      // Truncate cache
      const truncated = messageCacheRef.current.slice(0, idx + 1)
      if (truncated[idx]) {
        truncated[idx] = {
          ...truncated[idx],
          compactionRecord: undefined,
          hasCompactionMarker: false
        }
      }
      messageCacheRef.current = truncated
      loadedFromEndRef.current = truncated.length

      // Re-resolve compaction anchor
      const newAnchor = resolveLatestCompactionAnchor(truncated)
      setCompactionAnchor(newAnchor)

      // Sync to display window
      syncFromCache(roundWindowStartRef.current)
    },
    [syncFromCache]
  )

  return {
    messages,
    setMessages,
    hasMore,
    pendingAssistantMsg,
    compactionAnchor,
    loadMore,
    refreshMessages,
    optimisticRemove,
    setStreamSessionId,
    truncateMessages,
    ensureMessageAttachments
  }
}
