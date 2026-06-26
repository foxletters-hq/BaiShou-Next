import { useState, useRef, useEffect, useCallback, type RefObject } from 'react'
import type { FlatList, NativeScrollEvent, NativeSyntheticEvent } from 'react-native'

const BOTTOM_THRESHOLD_PX = 48

export type ScrollFollowMode = 'following' | 'idle'

export interface UseAgentChatScrollParams {
  sessionId: string | null
  messages: Array<{ id?: string; role?: string }>
  streamingText: string
  streamingReasoning: string
  isStreaming: boolean
  isStreamBridgeActive: boolean
  activeTool: { name: string } | null
}

function isNearBottom(nativeEvent: NativeScrollEvent, threshold = BOTTOM_THRESHOLD_PX): boolean {
  const { contentOffset, contentSize, layoutMeasurement } = nativeEvent
  return contentSize.height - contentOffset.y - layoutMeasurement.height <= threshold
}

/**
 * 聊天列表滚动跟随（对齐 desktop useChatScroll 状态机）
 *
 * - following：流式/新消息时自动贴底
 * - idle：用户离开底部后停止跟随，显示回到底部按钮
 *
 * 进入 following：切换会话、点击回到底部、发送时已在底部、在底部继续向下滚
 * 退出 following：向上滚、离开底部区域
 */
export function useAgentChatScroll({
  sessionId,
  messages,
  streamingText,
  streamingReasoning,
  isStreaming,
  isStreamBridgeActive,
  activeTool
}: UseAgentChatScrollParams) {
  const streamingActive = isStreaming || isStreamBridgeActive
  const followModeRef = useRef<ScrollFollowMode>('following')
  const [followMode, setFollowMode] = useState<ScrollFollowMode>('following')
  const [showScrollButton, setShowScrollButton] = useState(false)
  const prevSessionIdRef = useRef<string | null>(sessionId)
  const pendingInstantBottomRef = useRef(false)
  const suppressInterruptRef = useRef(0)
  const isSmoothScrollingRef = useRef(false)
  const isUserDraggingRef = useRef(false)
  const isMomentumScrollingRef = useRef(false)
  const lastScrollOffsetRef = useRef(0)
  const lastScrollMetricsRef = useRef<NativeScrollEvent | null>(null)
  const streamFollowRafRef = useRef<number | null>(null)
  const contentSizeFollowRafRef = useRef<number | null>(null)
  const smoothSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollGenerationRef = useRef(0)
  const prevNewestIdRef = useRef<string | null>(null)
  const flatListRefHolder = useRef<RefObject<FlatList | null> | null>(null)

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

  const cancelPendingProgrammaticScroll = useCallback(() => {
    scrollGenerationRef.current += 1
    isSmoothScrollingRef.current = false

    if (smoothSettleTimerRef.current) {
      clearTimeout(smoothSettleTimerRef.current)
      smoothSettleTimerRef.current = null
    }
    if (streamFollowRafRef.current != null) {
      cancelAnimationFrame(streamFollowRafRef.current)
      streamFollowRafRef.current = null
    }
    if (contentSizeFollowRafRef.current != null) {
      cancelAnimationFrame(contentSizeFollowRafRef.current)
      contentSizeFollowRafRef.current = null
    }
  }, [])

  const jumpToBottomInstant = useCallback((flatListRef: RefObject<FlatList | null>) => {
    if (!flatListRef.current) return
    suppressInterruptRef.current += 2
    flatListRef.current.scrollToEnd({ animated: false })
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated: false })
    })
  }, [])

  const followScrollToBottom = useCallback(
    (flatListRef: RefObject<FlatList | null>) => {
      if (followModeRef.current !== 'following') return
      jumpToBottomInstant(flatListRef)
    },
    [jumpToBottomInstant]
  )

  const beginFollowIfAtBottom = useCallback(
    (flatListRef: RefObject<FlatList | null>) => {
      flatListRefHolder.current = flatListRef
      const metrics = lastScrollMetricsRef.current
      if (metrics && !isNearBottom(metrics)) return
      enterFollowing()
      jumpToBottomInstant(flatListRef)
    },
    [enterFollowing, jumpToBottomInstant]
  )

  const scrollToBottom = useCallback(
    (flatListRef: RefObject<FlatList | null>, animated = true) => {
      if (!flatListRef.current) return
      flatListRefHolder.current = flatListRef
      enterFollowing()
      isSmoothScrollingRef.current = true
      const scrollGeneration = ++scrollGenerationRef.current
      if (smoothSettleTimerRef.current) {
        clearTimeout(smoothSettleTimerRef.current)
      }
      flatListRef.current.scrollToEnd({ animated })

      const settleMs = animated ? 720 : 0
      smoothSettleTimerRef.current = setTimeout(() => {
        smoothSettleTimerRef.current = null
        if (scrollGeneration !== scrollGenerationRef.current || isUserDraggingRef.current) return
        flatListRef.current?.scrollToEnd({ animated: false })
        requestAnimationFrame(() => {
          if (scrollGeneration !== scrollGenerationRef.current || isUserDraggingRef.current) return
          enterFollowing()
          isSmoothScrollingRef.current = false
        })
      }, settleMs)
    },
    [enterFollowing]
  )

  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nativeEvent = event.nativeEvent
      lastScrollMetricsRef.current = nativeEvent
      const offsetY = nativeEvent.contentOffset.y
      const deltaY = offsetY - lastScrollOffsetRef.current
      lastScrollOffsetRef.current = offsetY

      if (isUserDraggingRef.current || isMomentumScrollingRef.current) {
        if (!isNearBottom(nativeEvent)) {
          exitFollowing()
        }
        return
      }

      if (isSmoothScrollingRef.current) return

      if (suppressInterruptRef.current > 0) {
        suppressInterruptRef.current -= 1
        return
      }

      if (deltaY < -2) {
        exitFollowing()
      } else if (deltaY > 2 && isNearBottom(nativeEvent)) {
        enterFollowing()
      } else if (!isNearBottom(nativeEvent)) {
        exitFollowing()
      }
    },
    [enterFollowing, exitFollowing]
  )

  const followStreamBottom = useCallback(
    (flatListRef: RefObject<FlatList | null>) => {
      if (!isStreaming && !isStreamBridgeActive) return
      if (followModeRef.current !== 'following') return
      if (isUserDraggingRef.current || isMomentumScrollingRef.current) return
      if (streamFollowRafRef.current != null) return

      streamFollowRafRef.current = requestAnimationFrame(() => {
        streamFollowRafRef.current = null
        if (isUserDraggingRef.current || isMomentumScrollingRef.current) return
        jumpToBottomInstant(flatListRef)
      })
    },
    [isStreaming, isStreamBridgeActive, jumpToBottomInstant]
  )

  const onContentSizeChange = useCallback(
    (flatListRef: RefObject<FlatList | null>) => {
      if (!isStreaming && !isStreamBridgeActive) return
      if (followModeRef.current !== 'following') return
      if (isUserDraggingRef.current || isMomentumScrollingRef.current) return
      if (contentSizeFollowRafRef.current != null) return

      contentSizeFollowRafRef.current = requestAnimationFrame(() => {
        contentSizeFollowRafRef.current = null
        if (isUserDraggingRef.current || isMomentumScrollingRef.current) return
        jumpToBottomInstant(flatListRef)
      })
    },
    [isStreaming, isStreamBridgeActive, jumpToBottomInstant]
  )

  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      prevSessionIdRef.current = sessionId
      pendingInstantBottomRef.current = true
      prevNewestIdRef.current = null
      lastScrollOffsetRef.current = 0
      enterFollowing()
    }
  }, [sessionId, enterFollowing])

  useEffect(() => {
    if (!pendingInstantBottomRef.current || messages.length === 0) return
    const ref = flatListRefHolder.current
    if (!ref) return
    jumpToBottomInstant(ref)
    pendingInstantBottomRef.current = false
    enterFollowing()
  }, [sessionId, messages.length, jumpToBottomInstant, enterFollowing])

  useEffect(() => {
    if (pendingInstantBottomRef.current) return

    const newestMsg = messages[messages.length - 1]
    const isNewMessageAdded = newestMsg?.id && newestMsg.id !== prevNewestIdRef.current
    const isNewUserMessage = isNewMessageAdded && newestMsg?.role === 'user'

    if (isNewUserMessage || activeTool) {
      const ref = flatListRefHolder.current
      if (ref) followScrollToBottom(ref)
    }
    prevNewestIdRef.current = newestMsg?.id ?? null
  }, [messages, activeTool, followScrollToBottom])

  useEffect(() => {
    const ref = flatListRefHolder.current
    if (!ref) return
    if (!isStreaming && !isStreamBridgeActive) return
    followStreamBottom(ref)
  }, [
    streamingText,
    streamingReasoning,
    isStreaming,
    isStreamBridgeActive,
    followStreamBottom
  ])

  const prevIsStreamingRef = useRef(isStreaming)
  useEffect(() => {
    const ref = flatListRefHolder.current
    if (prevIsStreamingRef.current && !isStreaming && ref) {
      followScrollToBottom(ref)
    }
    prevIsStreamingRef.current = isStreaming
  }, [isStreaming, followScrollToBottom])

  const prevStreamBridgeRef = useRef(isStreamBridgeActive)
  useEffect(() => {
    const ref = flatListRefHolder.current
    if (prevStreamBridgeRef.current && !isStreamBridgeActive && ref) {
      followScrollToBottom(ref)
    }
    prevStreamBridgeRef.current = isStreamBridgeActive
  }, [isStreamBridgeActive, followScrollToBottom])

  useEffect(() => {
    return () => {
      if (smoothSettleTimerRef.current) {
        clearTimeout(smoothSettleTimerRef.current)
      }
      if (streamFollowRafRef.current != null) {
        cancelAnimationFrame(streamFollowRafRef.current)
      }
      if (contentSizeFollowRafRef.current != null) {
        cancelAnimationFrame(contentSizeFollowRafRef.current)
      }
    }
  }, [])

  const bindFlatList = useCallback((flatListRef: RefObject<FlatList | null>) => {
    flatListRefHolder.current = flatListRef
  }, [])

  const handleScrollBeginDrag = useCallback(() => {
    isUserDraggingRef.current = true
    cancelPendingProgrammaticScroll()
    exitFollowing()
  }, [cancelPendingProgrammaticScroll, exitFollowing])

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      lastScrollMetricsRef.current = event.nativeEvent
      lastScrollOffsetRef.current = event.nativeEvent.contentOffset.y
      isUserDraggingRef.current = false

      if (streamingActive) {
        exitFollowing()
        return
      }

      if (isMomentumScrollingRef.current) return
      if (isNearBottom(event.nativeEvent)) {
        enterFollowing()
      } else {
        exitFollowing()
      }
    },
    [enterFollowing, exitFollowing, streamingActive]
  )

  const handleMomentumScrollBegin = useCallback(() => {
    isMomentumScrollingRef.current = true
    cancelPendingProgrammaticScroll()
    exitFollowing()
  }, [cancelPendingProgrammaticScroll, exitFollowing])

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      lastScrollMetricsRef.current = event.nativeEvent
      lastScrollOffsetRef.current = event.nativeEvent.contentOffset.y
      isMomentumScrollingRef.current = false

      if (streamingActive) {
        exitFollowing()
        return
      }

      if (isNearBottom(event.nativeEvent)) {
        enterFollowing()
      } else {
        exitFollowing()
      }
    },
    [enterFollowing, exitFollowing, streamingActive]
  )

  return {
    followMode,
    showScrollButton,
    handleListScroll,
    handleScrollBeginDrag,
    handleScrollEndDrag,
    handleMomentumScrollBegin,
    handleMomentumScrollEnd,
    scrollToBottom,
    beginFollowIfAtBottom,
    followStreamBottom,
    onContentSizeChange,
    bindFlatList
  }
}
