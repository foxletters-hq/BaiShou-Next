import { useState, useRef, useEffect, useCallback } from 'react'

export interface PendingAssistantMsg {
  id: string
  content: string
  reasoning?: string
  toolInvocations?: any[]
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
  loadMore: () => Promise<void>
  refreshMessages: (retryCount?: number, overrideSessionId?: string) => Promise<boolean>
  optimisticRemove: (optimisticId: string) => void
  setStreamSessionId: (id: string | null) => void
}

/** 首屏约 10 轮对话（按每轮约 4 条消息粗估，含工具调用） */
export const CHAT_INITIAL_ROUND_BATCH = 10
const CHAT_MSG_ESTIMATE_PER_ROUND = 4
export const CHAT_INITIAL_MESSAGE_BATCH =
  CHAT_INITIAL_ROUND_BATCH * CHAT_MSG_ESTIMATE_PER_ROUND
const CHAT_LOAD_MORE_PAGE = 20

function applyTailPage(
  fetched: any[],
  pageSize: number
): { display: any[]; hasMore: boolean; loadedFromEnd: number } {
  if (!fetched?.length) {
    return { display: [], hasMore: false, loadedFromEnd: 0 }
  }
  const hasMore = fetched.length > pageSize
  const display = hasMore ? fetched.slice(1) : fetched
  return { display, hasMore, loadedFromEnd: fetched.length }
}

/**
 * 消息生命周期管理 Hook (去乐观化版本)
 * 所有的状态更新均建立在数据库真实数据之上。
 */
export function useChatMessages(params: UseChatMessagesParams): UseChatMessagesResult {
  const { sessionId, isStreaming, streamingText, streamingReasoning } = params

  const [messages, setMessages] = useState<any[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [pendingAssistantMsg, setPendingAssistantMsg] = useState<PendingAssistantMsg | null>(null)
  const currentSessionIdRef = useRef<string | null>(null)
  const streamSessionIdRef = useRef<string | null>(null)
  const loadedFromEndRef = useRef(0)

  const messagesRef = useRef<any[]>(messages)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const refreshMessages = useCallback(
    async (retryCount = 1, overrideSessionId?: string): Promise<boolean> => {
      const targetId = overrideSessionId || sessionId
      if (!targetId) return false

      for (let attempt = 0; attempt < retryCount; attempt++) {
        try {
          const wantCount = Math.max(
            messagesRef.current.length,
            loadedFromEndRef.current,
            CHAT_INITIAL_MESSAGE_BATCH
          )
          const fetchLimit = wantCount + 1

          const fetched = await window.electron.ipcRenderer.invoke(
            'agent:get-messages',
            targetId,
            fetchLimit,
            0
          )

          if (fetched) {
            const { display, hasMore: more, loadedFromEnd } = applyTailPage(fetched, wantCount)
            setMessages(display)
            setHasMore(more)
            loadedFromEndRef.current = loadedFromEnd
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
    [sessionId]
  )

  useEffect(() => {
    if (!sessionId) {
      setMessages([])
      setHasMore(false)
      loadedFromEndRef.current = 0
      currentSessionIdRef.current = null
      setPendingAssistantMsg(null)
      return
    }

    if (sessionId !== currentSessionIdRef.current) {
      currentSessionIdRef.current = sessionId
      loadedFromEndRef.current = 0

      const loadMessages = async () => {
        try {
          const fetched = await window.electron.ipcRenderer.invoke(
            'agent:get-messages',
            sessionId,
            CHAT_INITIAL_MESSAGE_BATCH + 1,
            0
          )
          if (fetched) {
            const { display, hasMore: more, loadedFromEnd } = applyTailPage(
              fetched,
              CHAT_INITIAL_MESSAGE_BATCH
            )
            setMessages(display)
            setHasMore(more)
            loadedFromEndRef.current = loadedFromEnd
          }
        } catch (e) {
          console.error('[useChatMessages] DB fetch error:', e)
          setMessages([])
          setHasMore(false)
          loadedFromEndRef.current = 0
        }
      }
      void loadMessages()
    }
  }, [sessionId])

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
    try {
      const fetched = await window.electron.ipcRenderer.invoke(
        'agent:get-messages',
        sessionId,
        CHAT_LOAD_MORE_PAGE + 1,
        loadedFromEndRef.current
      )
      if (!fetched?.length) {
        setHasMore(false)
        return
      }
      const hasMorePage = fetched.length > CHAT_LOAD_MORE_PAGE
      const page = hasMorePage ? fetched.slice(1) : fetched
      loadedFromEndRef.current += fetched.length
      setMessages((prev) => [...page, ...prev])
      setHasMore(hasMorePage)
    } catch (e) {
      console.warn('[useChatMessages] loadMore failed:', e)
    }
  }, [sessionId])

  const optimisticRemove = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const setStreamSessionId = useCallback((id: string | null) => {
    streamSessionIdRef.current = id
  }, [])

  return {
    messages,
    setMessages,
    hasMore,
    pendingAssistantMsg,
    loadMore,
    refreshMessages,
    optimisticRemove,
    setStreamSessionId
  }
}
