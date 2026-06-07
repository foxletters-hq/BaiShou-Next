import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'

export interface UseChatScrollParams {
  sessionId: string | undefined
  messages: any[]
  streamingText: string
  streamingReasoning: string
  isStreaming: boolean
  activeTool: { name: string; args: any } | null
}

export interface UseChatScrollResult {
  scrollRef: React.RefObject<HTMLDivElement | null>
  showScrollButton: boolean
  scrollToBottom: (force?: boolean) => void
}

/**
 * 聊天滚动管理 Hook
 *
 * 职责：
 * 1. 自动滚动到底部（新消息/流式输出时）
 * 2. 用户手动上翻时暂停自动滚动
 * 3. 显示"回到底部"按钮
 * 4. 切换会话时瞬间定位到底部（避免 smooth 滚过全量 DOM）
 */
export function useChatScroll(params: UseChatScrollParams): UseChatScrollResult {
  const { sessionId, messages, streamingText, streamingReasoning, isStreaming, activeTool } = params

  const scrollRef = useRef<HTMLDivElement>(null)
  const isUserScrollingRef = useRef(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const pendingInstantBottomRef = useRef(false)
  const prevSessionIdRef = useRef<string | undefined>(sessionId)

  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      prevSessionIdRef.current = sessionId
      pendingInstantBottomRef.current = true
      isUserScrollingRef.current = false
      setShowScrollButton(false)
    }
  }, [sessionId])

  const jumpToBottomInstant = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const prevBehavior = el.style.scrollBehavior
    el.style.scrollBehavior = 'auto'
    el.scrollTop = el.scrollHeight
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
      el.style.scrollBehavior = prevBehavior
    })
  }, [])

  useLayoutEffect(() => {
    if (!pendingInstantBottomRef.current || messages.length === 0) return
    jumpToBottomInstant()
    pendingInstantBottomRef.current = false
    isUserScrollingRef.current = false
    setShowScrollButton(false)
  }, [sessionId, messages, jumpToBottomInstant])

  useEffect(() => {
    const handleScroll = () => {
      if (!scrollRef.current) return
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 150
      isUserScrollingRef.current = !isAtBottom
      setShowScrollButton(!isAtBottom)
    }
    const el = scrollRef.current
    if (el) el.addEventListener('scroll', handleScroll)
    return () => {
      if (el) el.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const scrollToBottom = useCallback(
    (force = false) => {
      if (scrollRef.current && (!isUserScrollingRef.current || force)) {
        jumpToBottomInstant()
        if (force) {
          setShowScrollButton(false)
          isUserScrollingRef.current = false
        }
      }
    },
    [jumpToBottomInstant]
  )

  const prevNewestIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (pendingInstantBottomRef.current) return

    const newestMsg = messages[messages.length - 1]
    const isNewMessageAdded = newestMsg?.id && newestMsg.id !== prevNewestIdRef.current

    if (isNewMessageAdded || isStreaming || streamingText || activeTool) {
      scrollToBottom()
    }
    prevNewestIdRef.current = newestMsg?.id || null
  }, [messages, streamingText, streamingReasoning, isStreaming, activeTool, scrollToBottom])

  return { scrollRef, showScrollButton, scrollToBottom }
}
