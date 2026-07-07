import { useCallback } from 'react'
import type { MockChatAttachment } from '@baishou/shared'
import {
  CHAT_MESSAGE_FETCH_LIMIT,
  CHAT_ROUNDS_PER_PAGE,
  expandRoundWindowStart,
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
      createdAt?: Date
    }) => {
      if (messageCacheRef.current.some((m) => m.id === payload.id)) return

      const maxOrder = messageCacheRef.current.reduce(
        (max, m) => Math.max(max, typeof m.orderIndex === 'number' ? m.orderIndex : 0),
        0
      )
      const createdAt = payload.createdAt ?? new Date()
      const msg = {
        id: payload.id,
        role: 'user',
        content: payload.content,
        attachments: payload.attachments,
        orderIndex: maxOrder + 1,
        createdAt,
        parts: payload.content
          ? [
              {
                id: `${payload.id}-text`,
                messageId: payload.id,
                type: 'text',
                data: { text: payload.content }
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
