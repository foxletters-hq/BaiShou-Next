import { useState, useRef, useEffect, useCallback, type RefObject } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native'
import { logAgentScrollEvent } from '../utils/agent-scroll-diagnostics'

const BOTTOM_THRESHOLD_PX = 48

export type ScrollFollowMode = 'following' | 'idle'

export interface UseAgentChatScrollParams {
  sessionId: string | null
  messages: Array<{ id?: string; role?: string }>
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
 */
export function useAgentChatScroll({
  sessionId,
  messages,
  isStreaming,
  isStreamBridgeActive,
  activeTool
}: UseAgentChatScrollParams) {
  const streamingActive = isStreaming || isStreamBridgeActive
  const followModeRef = useRef<ScrollFollowMode>('following')
  const [followMode, setFollowMode] = useState<ScrollFollowMode>('following')
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [contentAnchorMinHeight, setContentAnchorMinHeight] = useState<number | undefined>(
    undefined
  )
  const prevSessionIdRef = useRef<string | null>(sessionId)
  const pendingInstantBottomRef = useRef(false)
  const suppressInterruptRef = useRef(0)
  const isSmoothScrollingRef = useRef(false)
  const isUserDraggingRef = useRef(false)
  const isMomentumScrollingRef = useRef(false)
  const lastScrollOffsetRef = useRef(0)
  const lastScrollMetricsRef = useRef<NativeScrollEvent | null>(null)
  const contentFollowRafRef = useRef<number | null>(null)
  const smoothSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollGenerationRef = useRef(0)
  const prevNewestIdRef = useRef<string | null>(null)
  const scrollViewRefHolder = useRef<RefObject<ScrollView | null> | null>(null)
  const contentResizeLogThrottleRef = useRef(0)
  const peakContentHeightRef = useRef(0)
  const lastContentHeightRef = useRef(0)
  const streamingFollowRafRef = useRef<number | null>(null)

  const setFollowModeState = useCallback((mode: ScrollFollowMode) => {
    if (followModeRef.current === mode) return
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
    if (contentFollowRafRef.current != null) {
      cancelAnimationFrame(contentFollowRafRef.current)
      contentFollowRafRef.current = null
    }
  }, [])

  const jumpToBottomInstant = useCallback((scrollViewRef: RefObject<ScrollView | null>) => {
    if (!scrollViewRef.current) return
    suppressInterruptRef.current += 1
    scrollViewRef.current.scrollToEnd({ animated: false })
  }, [])

  const releaseContentHandoff = useCallback(() => {
    setContentAnchorMinHeight((prev) => {
      if (prev != null) {
        logAgentScrollEvent('content_handoff_end', { prevAnchor: Math.round(prev) })
      }
      return undefined
    })
    peakContentHeightRef.current = 0
  }, [])

  /** 布局交接期用 minHeight 托住列表，避免内容变矮时 offset 被钳到顶部；仅由 releaseContentHandoff 显式释放 */
  const beginContentHandoff = useCallback(() => {
    if (followModeRef.current !== 'following') return

    const anchor = Math.max(peakContentHeightRef.current, lastContentHeightRef.current)
    if (anchor <= 0) return

    setContentAnchorMinHeight((prev) => {
      const next = Math.max(prev ?? 0, anchor)
      if ((prev ?? 0) < next - 1) {
        logAgentScrollEvent('content_handoff_begin', { anchorH: Math.round(next) })
      }
      return next
    })
  }, [])

  /** 在释放 minHeight 前先校正滚动位置，避免 offset 超出新内容高度被钳到顶部 */
  const finalizeContentHandoff = useCallback(() => {
    releaseContentHandoff()
    requestAnimationFrame(() => {
      const ref = scrollViewRefHolder.current
      if (ref?.current && followModeRef.current === 'following') {
        ref.current.scrollToEnd({ animated: false })
      }
    })
  }, [releaseContentHandoff])

  const scheduleFollowBottom = useCallback(
    (scrollViewRef: RefObject<ScrollView | null>) => {
      if (followModeRef.current !== 'following') return
      if (isUserDraggingRef.current || isMomentumScrollingRef.current) return
      if (contentFollowRafRef.current != null) return

      contentFollowRafRef.current = requestAnimationFrame(() => {
        contentFollowRafRef.current = null
        if (isUserDraggingRef.current || isMomentumScrollingRef.current) return
        jumpToBottomInstant(scrollViewRef)
      })
    },
    [jumpToBottomInstant]
  )

  const followScrollToBottom = useCallback(
    (scrollViewRef: RefObject<ScrollView | null>) => {
      if (followModeRef.current !== 'following') return
      scheduleFollowBottom(scrollViewRef)
    },
    [scheduleFollowBottom]
  )

  const beginFollowIfAtBottom = useCallback(
    (scrollViewRef: RefObject<ScrollView | null>) => {
      scrollViewRefHolder.current = scrollViewRef
      const metrics = lastScrollMetricsRef.current
      if (metrics && !isNearBottom(metrics)) return
      enterFollowing()
      jumpToBottomInstant(scrollViewRef)
    },
    [enterFollowing, jumpToBottomInstant]
  )

  const scrollToBottom = useCallback(
    (scrollViewRef: RefObject<ScrollView | null>, animated = true) => {
      if (!scrollViewRef.current) return
      scrollViewRefHolder.current = scrollViewRef
      enterFollowing()
      isSmoothScrollingRef.current = true
      suppressInterruptRef.current += 2
      const scrollGeneration = ++scrollGenerationRef.current
      if (smoothSettleTimerRef.current) {
        clearTimeout(smoothSettleTimerRef.current)
      }
      scrollViewRef.current.scrollToEnd({ animated })

      const settleMs = animated ? 720 : 0
      smoothSettleTimerRef.current = setTimeout(() => {
        smoothSettleTimerRef.current = null
        if (scrollGeneration !== scrollGenerationRef.current || isUserDraggingRef.current) return
        jumpToBottomInstant(scrollViewRef)
        requestAnimationFrame(() => {
          if (scrollGeneration !== scrollGenerationRef.current || isUserDraggingRef.current) return
          enterFollowing()
          isSmoothScrollingRef.current = false
        })
      }, settleMs)
    },
    [enterFollowing, jumpToBottomInstant]
  )

  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nativeEvent = event.nativeEvent
      lastScrollMetricsRef.current = nativeEvent
      const offsetY = nativeEvent.contentOffset.y
      const prevOffsetY = lastScrollOffsetRef.current
      const deltaY = offsetY - prevOffsetY
      lastScrollOffsetRef.current = offsetY

      if (
        typeof __DEV__ !== 'undefined' &&
        __DEV__ &&
        prevOffsetY > 300 &&
        offsetY < 80 &&
        prevOffsetY - offsetY > 250
      ) {
        logAgentScrollEvent('jump_to_top', {
          fromY: Math.round(prevOffsetY),
          toY: Math.round(offsetY),
          contentH: Math.round(nativeEvent.contentSize.height),
          viewportH: Math.round(nativeEvent.layoutMeasurement.height),
          deltaY: Math.round(deltaY)
        })
      }

      if (isSmoothScrollingRef.current) return

      if (isUserDraggingRef.current || isMomentumScrollingRef.current) {
        if (!isNearBottom(nativeEvent)) {
          exitFollowing()
        }
        return
      }

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

  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      prevSessionIdRef.current = sessionId
      pendingInstantBottomRef.current = true
      prevNewestIdRef.current = null
      lastScrollOffsetRef.current = 0
      releaseContentHandoff()
      enterFollowing()
      logAgentScrollEvent('session_change', { sessionId })
    }
  }, [sessionId, enterFollowing, releaseContentHandoff])

  useEffect(() => {
    if (!pendingInstantBottomRef.current || messages.length === 0) return
    const ref = scrollViewRefHolder.current
    if (!ref) return
    logAgentScrollEvent('pending_instant_bottom', { messagesCount: messages.length })
    jumpToBottomInstant(ref)
    pendingInstantBottomRef.current = false
    enterFollowing()
  }, [sessionId, messages.length, jumpToBottomInstant, enterFollowing])

  const newestMessageId = messages[messages.length - 1]?.id ?? null
  const newestMessageRole = messages[messages.length - 1]?.role ?? null

  useEffect(() => {
    if (pendingInstantBottomRef.current) return

    const isNewMessageAdded = newestMessageId && newestMessageId !== prevNewestIdRef.current
    const isNewUserMessage = isNewMessageAdded && newestMessageRole === 'user'

    if (isNewUserMessage || activeTool) {
      const ref = scrollViewRefHolder.current
      if (ref) followScrollToBottom(ref)
    }
    prevNewestIdRef.current = newestMessageId
  }, [newestMessageId, newestMessageRole, activeTool, followScrollToBottom])

  const handleContentSizeChange = useCallback(
    (scrollViewRef: RefObject<ScrollView | null>, contentHeight: number) => {
      const now = Date.now()
      if (now - contentResizeLogThrottleRef.current > 400) {
        contentResizeLogThrottleRef.current = now
        const metrics = lastScrollMetricsRef.current
        const viewportH = metrics?.layoutMeasurement.height ?? 0
        const maxOffset = Math.max(0, contentHeight - viewportH)
        logAgentScrollEvent('content_size', {
          contentH: Math.round(contentHeight),
          offsetY: Math.round(lastScrollOffsetRef.current),
          maxOffset: Math.round(maxOffset),
          streaming: isStreaming || isStreamBridgeActive,
          anchorMinH: contentAnchorMinHeight ?? 0
        })
      }

      if (contentHeight > 0) {
        const prevHeight = lastContentHeightRef.current
        lastContentHeightRef.current = contentHeight
        if (isStreaming || isStreamBridgeActive) {
          peakContentHeightRef.current = Math.max(peakContentHeightRef.current, contentHeight)
        }

        if (!isStreaming && !isStreamBridgeActive) return
        if (followModeRef.current !== 'following') return
        if (!scrollViewRef.current) return
        if (Math.abs(contentHeight - prevHeight) < 1) return
        if (streamingFollowRafRef.current != null) return

        streamingFollowRafRef.current = requestAnimationFrame(() => {
          streamingFollowRafRef.current = null
          if (followModeRef.current !== 'following') return
          jumpToBottomInstant(scrollViewRef)
        })
      }
    },
    [isStreaming, isStreamBridgeActive, jumpToBottomInstant, contentAnchorMinHeight]
  )

  const streamingActiveRef = useRef(isStreaming || isStreamBridgeActive)
  useEffect(() => {
    const wasStreaming = streamingActiveRef.current
    const nowStreaming = isStreaming || isStreamBridgeActive

    if (wasStreaming && !nowStreaming) {
      logAgentScrollEvent('stream_end', {
        shouldFollow: followModeRef.current === 'following',
        savedOffset: Math.round(lastScrollOffsetRef.current),
        peakContentH: Math.round(peakContentHeightRef.current)
      })
    } else if (!wasStreaming && nowStreaming) {
      releaseContentHandoff()
      lastContentHeightRef.current = 0
      logAgentScrollEvent('stream_start')
    }

    streamingActiveRef.current = nowStreaming
  }, [isStreaming, isStreamBridgeActive, releaseContentHandoff])

  useEffect(() => {
    return () => {
      if (smoothSettleTimerRef.current) {
        clearTimeout(smoothSettleTimerRef.current)
      }
      if (contentFollowRafRef.current != null) {
        cancelAnimationFrame(contentFollowRafRef.current)
      }
      if (streamingFollowRafRef.current != null) {
        cancelAnimationFrame(streamingFollowRafRef.current)
      }
    }
  }, [])

  const bindFlatList = useCallback((scrollViewRef: RefObject<ScrollView | null>) => {
    scrollViewRefHolder.current = scrollViewRef
  }, [])

  const handleScrollBeginDrag = useCallback(() => {
    isUserDraggingRef.current = true
    if (isSmoothScrollingRef.current) return
    cancelPendingProgrammaticScroll()
    exitFollowing()
  }, [cancelPendingProgrammaticScroll, exitFollowing])

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      lastScrollMetricsRef.current = event.nativeEvent
      lastScrollOffsetRef.current = event.nativeEvent.contentOffset.y
      isUserDraggingRef.current = false

      if (isSmoothScrollingRef.current) return

      if (streamingActive) {
        if (isNearBottom(event.nativeEvent)) {
          enterFollowing()
        } else {
          exitFollowing()
        }
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
    if (isSmoothScrollingRef.current) return
    cancelPendingProgrammaticScroll()
    exitFollowing()
  }, [cancelPendingProgrammaticScroll, exitFollowing])

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      lastScrollMetricsRef.current = event.nativeEvent
      lastScrollOffsetRef.current = event.nativeEvent.contentOffset.y
      isMomentumScrollingRef.current = false

      if (isSmoothScrollingRef.current) return

      if (streamingActive) {
        if (isNearBottom(event.nativeEvent)) {
          enterFollowing()
        } else {
          exitFollowing()
        }
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
    contentAnchorMinHeight,
    beginContentHandoff,
    releaseContentHandoff,
    finalizeContentHandoff,
    handleListScroll,
    handleScrollBeginDrag,
    handleScrollEndDrag,
    handleMomentumScrollBegin,
    handleMomentumScrollEnd,
    scrollToBottom,
    beginFollowIfAtBottom,
    handleContentSizeChange,
    bindFlatList
  }
}
