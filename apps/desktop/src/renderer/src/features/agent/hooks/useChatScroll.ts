import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'

const BOTTOM_THRESHOLD_PX = 48
const SMOOTH_SCROLL_DURATION_MS = 720

export type ScrollFollowMode = 'following' | 'idle'

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
  followMode: ScrollFollowMode
  /** 用户点击「回到底部」：平滑滚动并进入跟随 */
  scrollToBottom: () => void
  /** 发送消息时调用：若在底部则进入跟随 */
  beginFollowIfAtBottom: () => void
}

function isNearBottom(el: HTMLElement, threshold = BOTTOM_THRESHOLD_PX): boolean {
  const { scrollTop, scrollHeight, clientHeight } = el
  return scrollHeight - scrollTop - clientHeight <= threshold
}

function smoothScrollToBottom(
  container: HTMLElement,
  duration = SMOOTH_SCROLL_DURATION_MS
): Promise<void> {
  const start = container.scrollTop
  const end = Math.max(0, container.scrollHeight - container.clientHeight)
  const change = end - start

  if (Math.abs(change) < 2) {
    container.scrollTop = end
    return Promise.resolve()
  }

  if (duration <= 0) {
    container.scrollTop = end
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const progress = Math.min((currentTime - startTime) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 4)
      container.scrollTop = start + change * ease

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        container.scrollTop = end
        resolve()
      }
    }

    requestAnimationFrame(animate)
  })
}

/**
 * 聊天滚动管理 Hook
 *
 * 跟随状态机：
 * - following：流式/新消息时自动贴底
 * - idle：用户滚动后停止跟随，显示回到底部按钮
 *
 * 进入 following：发送时已在底部、切换会话、点击回到底部、在底部向下滚轮
 * 退出 following：向上滚轮一次、滚动离开底部区域
 */
export function useChatScroll(params: UseChatScrollParams): UseChatScrollResult {
  const { sessionId, messages, streamingText, streamingReasoning, isStreaming, activeTool } = params

  const scrollRef = useRef<HTMLDivElement>(null)
  const followModeRef = useRef<ScrollFollowMode>('following')
  const [followMode, setFollowMode] = useState<ScrollFollowMode>('following')
  const [showScrollButton, setShowScrollButton] = useState(false)
  const pendingInstantBottomRef = useRef(false)
  const prevSessionIdRef = useRef<string | undefined>(sessionId)
  const suppressInterruptRef = useRef(0)
  const isSmoothScrollingRef = useRef(false)

  const setFollowModeState = useCallback((mode: ScrollFollowMode) => {
    followModeRef.current = mode
    setFollowMode(mode)
    setShowScrollButton(mode === 'idle')
  }, [])

  const enterFollowing = useCallback(() => {
    setFollowModeState('following')
  }, [setFollowModeState])

  const exitFollowing = useCallback(() => {
    if (followModeRef.current === 'idle') return
    setFollowModeState('idle')
  }, [setFollowModeState])

  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      prevSessionIdRef.current = sessionId
      pendingInstantBottomRef.current = true
      enterFollowing()
    }
  }, [sessionId, enterFollowing])

  const jumpToBottomInstant = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    suppressInterruptRef.current += 2
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
    enterFollowing()
  }, [sessionId, messages, jumpToBottomInstant, enterFollowing])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => {
      if (isSmoothScrollingRef.current) return
      if (suppressInterruptRef.current > 0) {
        suppressInterruptRef.current -= 1
        return
      }
      // 仅根据位置退出跟随；不自动重新进入，避免在底部附近反复被拉回
      if (!isNearBottom(el)) {
        exitFollowing()
      }
    }

    const handleWheel = (e: WheelEvent) => {
      if (isSmoothScrollingRef.current) return
      if (e.deltaY < 0) {
        exitFollowing()
        return
      }
      if (e.deltaY > 0 && isNearBottom(el)) {
        enterFollowing()
      }
    }

    const handleTouchMove = () => {
      if (isSmoothScrollingRef.current) return
      if (!isNearBottom(el)) {
        exitFollowing()
      }
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    el.addEventListener('wheel', handleWheel, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: true })

    return () => {
      el.removeEventListener('scroll', handleScroll)
      el.removeEventListener('wheel', handleWheel)
      el.removeEventListener('touchmove', handleTouchMove)
    }
  }, [sessionId, enterFollowing, exitFollowing])

  const followScrollToBottom = useCallback(() => {
    if (followModeRef.current !== 'following') return
    jumpToBottomInstant()
  }, [jumpToBottomInstant])

  const beginFollowIfAtBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el || !isNearBottom(el)) return
    enterFollowing()
    jumpToBottomInstant()
  }, [enterFollowing, jumpToBottomInstant])

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    enterFollowing()
    isSmoothScrollingRef.current = true

    void smoothScrollToBottom(el).finally(() => {
      el.scrollTop = el.scrollHeight
      requestAnimationFrame(() => {
        enterFollowing()
        isSmoothScrollingRef.current = false
      })
    })
  }, [enterFollowing])

  const prevNewestIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (pendingInstantBottomRef.current) return

    const newestMsg = messages[messages.length - 1]
    const isNewMessageAdded = newestMsg?.id && newestMsg.id !== prevNewestIdRef.current
    const isNewUserMessage = isNewMessageAdded && newestMsg?.role === 'user'

    // 新用户消息落库或工具执行时贴底；助手消息 DB 回写不重复贴底。
    if (isNewUserMessage || activeTool) {
      followScrollToBottom()
    }
    prevNewestIdRef.current = newestMsg?.id || null
  }, [messages, activeTool, followScrollToBottom])

  const streamFollowRafRef = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (!isStreaming || followModeRef.current !== 'following') return

    if (streamFollowRafRef.current != null) return

    streamFollowRafRef.current = requestAnimationFrame(() => {
      streamFollowRafRef.current = null
      jumpToBottomInstant()
    })
  }, [isStreaming, streamingText, streamingReasoning, jumpToBottomInstant])

  useEffect(() => {
    return () => {
      if (streamFollowRafRef.current != null) {
        cancelAnimationFrame(streamFollowRafRef.current)
        streamFollowRafRef.current = null
      }
    }
  }, [isStreaming])

  return {
    scrollRef,
    showScrollButton,
    followMode,
    scrollToBottom,
    beginFollowIfAtBottom
  }
}
