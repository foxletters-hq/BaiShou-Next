import { useCallback } from 'react'
import type { MockChatAttachment } from '@baishou/shared'
import {
  CHAT_MESSAGE_FETCH_LIMIT,
  CHAT_ROUNDS_PER_PAGE,
  cacheNeedsMoreForRoundWindow,
  enrichCacheForRoundWindow,
  groupMessagesIntoRounds
} from '../utils/chat-round-pagination'
import { chatSessionMessageCache } from '../utils/chat-session-message-cache'
import { fetchMessagesFromIpc, resolveLatestCompactionAnchor } from './useChatMessages.helpers'
import type { CompactionAnchor } from './useChatMessages.helpers'

export interface ChatMessageMutationRefs {
  sessionId: string | undefined
  messageCacheRef: React.MutableRefObject<any[]>
  roundWindowStartRef: React.MutableRefObject<number>
  fetchHasMoreRef: React.MutableRefObject<boolean>
  loadedFromEndRef: React.MutableRefObject<number>
  streamSessionIdRef: React.MutableRefObject<string | null>
  syncFromCache: (roundWindowStart: number) => {
    display: any[]
    hasMore: boolean
    roundWindowStart: number
  }
  persistSessionCache: (targetSessionId: string) => void
  ingestTailMessages: (
    tail: any[],
    preserveWindow: boolean
  ) => ReturnType<ChatMessageMutationRefs['syncFromCache']>
  setMessages: React.Dispatch<React.SetStateAction<any[]>>
  setHasMore: React.Dispatch<React.SetStateAction<boolean>>
  setCompactionAnchor: React.Dispatch<React.SetStateAction<CompactionAnchor | null>>
}

export function useChatMessageMutations(refs: ChatMessageMutationRefs) {
  const {
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
  } = refs

  const loadMore = useCallback(async () => {
    if (!sessionId) return

    const currentRounds = groupMessagesIntoRounds(messageCacheRef.current)
    const currentVisibleRounds = Math.max(
      CHAT_ROUNDS_PER_PAGE,
      currentRounds.length - roundWindowStartRef.current
    )
    const targetVisibleRounds = currentVisibleRounds + CHAT_ROUNDS_PER_PAGE

    if (
      !cacheNeedsMoreForRoundWindow(
        messageCacheRef.current,
        targetVisibleRounds,
        fetchHasMoreRef.current
      )
    ) {
      if (roundWindowStartRef.current > 0) {
        roundWindowStartRef.current = Math.max(0, currentRounds.length - targetVisibleRounds)
        syncFromCache(roundWindowStartRef.current)
        persistSessionCache(sessionId)
        return
      }
      setHasMore(false)
      return
    }

    try {
      const enriched = await enrichCacheForRoundWindow({
        cache: messageCacheRef.current,
        loadedFromEnd: loadedFromEndRef.current,
        fetchHasMore: fetchHasMoreRef.current,
        targetVisibleRounds,
        fetchPage: (limit, offset) => fetchMessagesFromIpc(sessionId, limit, offset),
        pageLimit: CHAT_MESSAGE_FETCH_LIMIT
      })
      if (
        enriched.loadedFromEnd === loadedFromEndRef.current &&
        !enriched.fetchHasMore &&
        roundWindowStartRef.current === 0
      ) {
        fetchHasMoreRef.current = false
        setHasMore(false)
        return
      }

      messageCacheRef.current = enriched.cache
      loadedFromEndRef.current = enriched.loadedFromEnd
      fetchHasMoreRef.current = enriched.fetchHasMore

      const nextRounds = groupMessagesIntoRounds(enriched.cache)
      roundWindowStartRef.current = Math.max(0, nextRounds.length - targetVisibleRounds)
      syncFromCache(roundWindowStartRef.current)
      persistSessionCache(sessionId)
    } catch (e) {
      console.warn('[useChatMessages] loadMore failed:', e)
    }
  }, [
    sessionId,
    syncFromCache,
    persistSessionCache,
    fetchHasMoreRef,
    loadedFromEndRef,
    messageCacheRef,
    roundWindowStartRef,
    setHasMore
  ])

  const optimisticRemove = useCallback(
    (id: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== id))
      messageCacheRef.current = messageCacheRef.current.filter((m) => m.id !== id)
      if (sessionId) {
        chatSessionMessageCache.delete(sessionId)
      }
    },
    [sessionId, messageCacheRef, setMessages]
  )

  const setStreamSessionId = useCallback(
    (id: string | null) => {
      streamSessionIdRef.current = id
    },
    [streamSessionIdRef]
  )

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
    [messageCacheRef, setMessages]
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
    [
      sessionId,
      syncFromCache,
      loadedFromEndRef,
      messageCacheRef,
      roundWindowStartRef,
      setCompactionAnchor
    ]
  )

  const appendSentUserMessage = useCallback(
    (payload: {
      id: string
      content: string
      attachments?: MockChatAttachment[]
      skillRefs?: Array<{ command: string; content: string }>
      createdAt?: Date
    }) => {
      if (messageCacheRef.current.some((m) => m.id === payload.id)) return

      const maxOrder = messageCacheRef.current.reduce(
        (max, m) => Math.max(max, typeof m.orderIndex === 'number' ? m.orderIndex : 0),
        0
      )
      const createdAt = payload.createdAt ?? new Date()
      const skillRefs = payload.skillRefs?.length ? payload.skillRefs : undefined
      const msg = {
        id: payload.id,
        role: 'user',
        content: payload.content,
        attachments: payload.attachments,
        skillRefs,
        orderIndex: maxOrder + 1,
        createdAt,
        parts: payload.content
          ? [
              {
                id: `${payload.id}-text`,
                messageId: payload.id,
                type: 'text',
                data: {
                  text: payload.content,
                  ...(skillRefs ? { displayText: payload.content, skillRefs } : {})
                }
              }
            ]
          : []
      }
      ingestTailMessages([msg], false)
    },
    [ingestTailMessages, messageCacheRef]
  )

  return {
    loadMore,
    optimisticRemove,
    setStreamSessionId,
    ensureMessageAttachments,
    truncateMessages,
    appendSentUserMessage
  }
}
