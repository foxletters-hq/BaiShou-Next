import { useState, useRef, useEffect, useCallback, type RefObject } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native'
import {
  logAgentScrollEvent,
  setAgentScrollDebugContext,
  type AgentScrollSnapshot
} from '../utils/agent-scroll-diagnostics'
import {
  POST_STREAM_WATCH_MS,
  isNearBottom,
  isNearContentBottom,
  handleAgentChatListScroll,
  type ScrollFollowMode,
  type UseAgentChatScrollParams
} from './agent-chat-scroll.helpers'
import { useAgentChatScrollAnchor } from './useAgentChatScrollAnchor'

export type { ScrollFollowMode, UseAgentChatScrollParams }

/**
 * 聊天列表滚动跟随（对齐 desktop useChatScroll 状态机）
 *
 * 用户一旦离开底部（userLockedAway），在点击「回到底部」/发送贴底/切会话/
 * 手势停在底部前绝不自动贴底。离开期间用 minHeight 托住内容，避免输出结束
 * 时流式尾部回落把 offset 钳回最底部。
 */
export function useAgentChatScroll({
  sessionId,
  messages,
  isStreaming,
  isStreamBridgeActive,
  activeTool
}: UseAgentChatScrollParams) {
  const followModeRef = useRef<ScrollFollowMode>('following')
  const [followMode, setFollowMode] = useState<ScrollFollowMode>('following')
  const [showScrollButton, setShowScrollButton] = useState(false)
  const prevSessionIdRef = useRef<string | null>(null)
  const pendingInstantBottomRef = useRef(false)
  const prevMessagesLengthRef = useRef(0)
  const suppressInterruptRef = useRef(0)
  const isSmoothScrollingRef = useRef(false)
  const isUserDraggingRef = useRef(false)
  const isMomentumScrollingRef = useRef(false)
  /** 用户主动离开底部后的硬锁，仅显式贴底操作可解除 */
  const userLockedAwayRef = useRef(false)
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
  /** 输出结束后短窗：强化诊断，标出拽底嫌疑 */
  const postStreamWatchUntilRef = useRef(0)
  const postStreamWatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastProgrammaticScrollAtRef = useRef(0)
  const lastProgrammaticReasonRef = useRef<string | null>(null)
  /** 子内容真实高度（不含 minHeight 托底）；折叠思考后靠它收回空白 */
  const lastIntrinsicContentHeightRef = useRef(0)
  const contentAnchorMinHeightRef = useRef<number | undefined>(undefined)

  const streamingActiveRef = useRef(isStreaming || isStreamBridgeActive)
  streamingActiveRef.current = isStreaming || isStreamBridgeActive

  const snapshotScroll = useCallback((): AgentScrollSnapshot => {
    const metrics = lastScrollMetricsRef.current
    const contentH = metrics?.contentSize.height ?? lastContentHeightRef.current
    const viewportH = metrics?.layoutMeasurement.height ?? 0
    const offsetY = lastScrollOffsetRef.current
    const maxOffset = Math.max(0, contentH - viewportH)
    const anchor = contentAnchorMinHeightRef.current
    return {
      offsetY: Math.round(offsetY),
      contentH: Math.round(contentH),
      viewportH: Math.round(viewportH),
      maxOffset: Math.round(maxOffset),
      nearBottom: metrics ? isNearBottom(metrics) : undefined,
      lockedAway: userLockedAwayRef.current,
      followMode: followModeRef.current,
      anchorMinH: anchor != null ? Math.round(anchor) : 0,
      peakContentH: Math.round(peakContentHeightRef.current)
    }
  }, [])

  const inPostStreamWatch = useCallback(() => Date.now() < postStreamWatchUntilRef.current, [])

  const setFollowModeState = useCallback((mode: ScrollFollowMode) => {
    if (followModeRef.current === mode) return
    followModeRef.current = mode
    setFollowMode(mode)
    setShowScrollButton(mode === 'idle')
    setAgentScrollDebugContext({ followMode: mode })
  }, [])

  const jumpToBottomInstantRef = useRef<
    (scrollViewRef: RefObject<ScrollView | null>, reason?: string) => void
  >(() => {})
  const enterFollowingRef = useRef<() => void>(() => {})
  const setFollowModeStateRef = useRef<(mode: ScrollFollowMode) => void>(setFollowModeState)
  setFollowModeStateRef.current = setFollowModeState

  const {
    contentAnchorMinHeight,
    holdContentHeightWhileAway,
    releaseContentHandoff,
    beginContentHandoff,
    finalizeContentHandoff,
    handleContentSizeChange,
    handleIntrinsicContentHeightChange,
    settleFollowModeAfterGesture
  } = useAgentChatScrollAnchor({
    userLockedAwayRef,
    followModeRef,
    lastScrollMetricsRef,
    lastScrollOffsetRef,
    lastContentHeightRef,
    lastIntrinsicContentHeightRef,
    peakContentHeightRef,
    contentAnchorMinHeightRef,
    streamingActiveRef,
    suppressInterruptRef,
    contentResizeLogThrottleRef,
    streamingFollowRafRef,
    scrollViewRefHolder,
    isStreaming,
    isStreamBridgeActive,
    inPostStreamWatch,
    snapshotScroll,
    jumpToBottomInstantRef,
    enterFollowingRef,
    setFollowModeStateRef
  })

  const enterFollowing = useCallback(() => {
    userLockedAwayRef.current = false
    setFollowModeState('following')
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
    if (streamingFollowRafRef.current != null) {
      cancelAnimationFrame(streamingFollowRafRef.current)
      streamingFollowRafRef.current = null
    }
  }, [])

  const exitFollowing = useCallback(() => {
    userLockedAwayRef.current = true
    cancelPendingProgrammaticScroll()
    if (followModeRef.current !== 'idle') {
      setFollowModeState('idle')
    }
    // 平时离开底部不托 minHeight：靠近底部时 preserveFloor 会凭空垫高，和 trim 死循环互拽。
    // 仅流式/交接窗需要托住，防止输出回落把人钳回底部。
    if (streamingActiveRef.current || inPostStreamWatch()) {
      holdContentHeightWhileAway()
    }
  }, [
    setFollowModeState,
    cancelPendingProgrammaticScroll,
    holdContentHeightWhileAway,
    inPostStreamWatch
  ])

  const jumpToBottomInstant = useCallback(
    (scrollViewRef: RefObject<ScrollView | null>, reason = 'jump_instant') => {
      if (!scrollViewRef.current) return
      if (userLockedAwayRef.current) {
        logAgentScrollEvent('programmatic_scroll_blocked', {
          reason,
          by: 'lockedAway',
          ...snapshotScroll(),
          postStreamWatch: inPostStreamWatch()
        })
        return
      }
      if (followModeRef.current !== 'following') {
        logAgentScrollEvent('programmatic_scroll_blocked', {
          reason,
          by: 'notFollowing',
          ...snapshotScroll(),
          postStreamWatch: inPostStreamWatch()
        })
        return
      }
      lastProgrammaticScrollAtRef.current = Date.now()
      lastProgrammaticReasonRef.current = reason
      logAgentScrollEvent('programmatic_scroll', {
        reason,
        method: 'scrollToEnd',
        ...snapshotScroll(),
        postStreamWatch: inPostStreamWatch()
      })
      suppressInterruptRef.current += 1
      scrollViewRef.current.scrollToEnd({ animated: false })
    },
    [snapshotScroll, inPostStreamWatch]
  )

  jumpToBottomInstantRef.current = jumpToBottomInstant
  enterFollowingRef.current = enterFollowing

  const scheduleFollowBottom = useCallback(
    (scrollViewRef: RefObject<ScrollView | null>, reason = 'schedule_follow') => {
      if (userLockedAwayRef.current) return
      if (followModeRef.current !== 'following') return
      if (isUserDraggingRef.current || isMomentumScrollingRef.current) return
      if (contentFollowRafRef.current != null) return

      contentFollowRafRef.current = requestAnimationFrame(() => {
        contentFollowRafRef.current = null
        if (userLockedAwayRef.current) return
        if (isUserDraggingRef.current || isMomentumScrollingRef.current) return
        jumpToBottomInstant(scrollViewRef, reason)
      })
    },
    [jumpToBottomInstant]
  )

  const followScrollToBottom = useCallback(
    (scrollViewRef: RefObject<ScrollView | null>, reason = 'follow_scroll') => {
      if (userLockedAwayRef.current) return
      if (followModeRef.current !== 'following') return
      scheduleFollowBottom(scrollViewRef, reason)
    },
    [scheduleFollowBottom]
  )

  const beginFollowIfAtBottom = useCallback(
    (scrollViewRef: RefObject<ScrollView | null>) => {
      scrollViewRefHolder.current = scrollViewRef
      const metrics = lastScrollMetricsRef.current
      if (metrics && !isNearBottom(metrics)) return
      enterFollowing()
      releaseContentHandoff()
      jumpToBottomInstant(scrollViewRef, 'begin_follow_if_at_bottom')
    },
    [enterFollowing, jumpToBottomInstant, releaseContentHandoff]
  )

  const scrollToBottom = useCallback(
    (scrollViewRef: RefObject<ScrollView | null>, animated = true) => {
      if (!scrollViewRef.current) return
      scrollViewRefHolder.current = scrollViewRef
      enterFollowing()
      releaseContentHandoff()
      isSmoothScrollingRef.current = true
      suppressInterruptRef.current += 2
      const scrollGeneration = ++scrollGenerationRef.current
      if (smoothSettleTimerRef.current) {
        clearTimeout(smoothSettleTimerRef.current)
      }
      lastProgrammaticScrollAtRef.current = Date.now()
      lastProgrammaticReasonRef.current = 'user_scroll_to_bottom'
      logAgentScrollEvent('programmatic_scroll', {
        reason: 'user_scroll_to_bottom',
        method: 'scrollToEnd',
        animated,
        ...snapshotScroll(),
        postStreamWatch: inPostStreamWatch()
      })
      scrollViewRef.current.scrollToEnd({ animated })

      const settleMs = animated ? 720 : 0
      smoothSettleTimerRef.current = setTimeout(() => {
        smoothSettleTimerRef.current = null
        if (scrollGeneration !== scrollGenerationRef.current || isUserDraggingRef.current) return
        jumpToBottomInstant(scrollViewRef, 'scroll_to_bottom_settle')
        requestAnimationFrame(() => {
          if (scrollGeneration !== scrollGenerationRef.current || isUserDraggingRef.current) return
          enterFollowing()
          isSmoothScrollingRef.current = false
        })
      }, settleMs)
    },
    [enterFollowing, jumpToBottomInstant, releaseContentHandoff, snapshotScroll, inPostStreamWatch]
  )

  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      handleAgentChatListScroll(event, {
        lastScrollMetricsRef,
        lastScrollOffsetRef,
        lastProgrammaticScrollAtRef,
        lastProgrammaticReasonRef,
        isUserDraggingRef,
        isSmoothScrollingRef,
        userLockedAwayRef,
        followModeRef,
        suppressInterruptRef,
        inPostStreamWatch,
        exitFollowing
      })
    },
    [exitFollowing, inPostStreamWatch]
  )

  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      prevSessionIdRef.current = sessionId
      pendingInstantBottomRef.current = true
      prevNewestIdRef.current = null
      lastScrollOffsetRef.current = 0
      userLockedAwayRef.current = false
      lastIntrinsicContentHeightRef.current = 0
      releaseContentHandoff()
      enterFollowing()
      logAgentScrollEvent('session_change', { sessionId })
    }
  }, [sessionId, enterFollowing, releaseContentHandoff])

  useEffect(() => {
    if (messages.length === 0) {
      prevMessagesLengthRef.current = 0
      return
    }

    const ref = scrollViewRefHolder.current
    const reloadedFromEmpty =
      prevMessagesLengthRef.current === 0 &&
      messages.length > 0 &&
      followModeRef.current === 'following' &&
      !userLockedAwayRef.current

    if (ref && (pendingInstantBottomRef.current || reloadedFromEmpty)) {
      logAgentScrollEvent('pending_instant_bottom', {
        messagesCount: messages.length,
        reloadedFromEmpty
      })
      jumpToBottomInstant(ref, reloadedFromEmpty ? 'reload_from_empty' : 'pending_instant_bottom')
      pendingInstantBottomRef.current = false
      enterFollowing()
    }

    prevMessagesLengthRef.current = messages.length
  }, [sessionId, messages.length, jumpToBottomInstant, enterFollowing])

  const scrollToBottomOnFocus = useCallback(() => {
    // 用户已主动离开底部：切回页面也不该解锁/清托底/强制贴底
    if (userLockedAwayRef.current || followModeRef.current === 'idle') {
      logAgentScrollEvent('focus_bottom_skipped', {
        reason: 'locked_or_idle',
        ...snapshotScroll()
      })
      return
    }

    pendingInstantBottomRef.current = true
    enterFollowing()

    const ref = scrollViewRefHolder.current
    if (!ref || messages.length === 0) {
      pendingInstantBottomRef.current = false
      return
    }

    requestAnimationFrame(() => {
      if (userLockedAwayRef.current || followModeRef.current === 'idle') {
        pendingInstantBottomRef.current = false
        logAgentScrollEvent('focus_bottom_skipped', {
          reason: 'locked_before_rAF',
          ...snapshotScroll()
        })
        return
      }
      jumpToBottomInstant(ref, 'focus_bottom')
      pendingInstantBottomRef.current = false
      requestAnimationFrame(() => {
        if (userLockedAwayRef.current || followModeRef.current === 'idle') return
        jumpToBottomInstant(ref, 'focus_bottom_rAF2')
      })
    })
  }, [messages.length, jumpToBottomInstant, enterFollowing, snapshotScroll])

  const newestMessageId = messages[messages.length - 1]?.id ?? null
  const newestMessageRole = messages[messages.length - 1]?.role ?? null

  useEffect(() => {
    if (pendingInstantBottomRef.current) return
    if (userLockedAwayRef.current) {
      prevNewestIdRef.current = newestMessageId
      return
    }

    const isNewMessageAdded = newestMessageId && newestMessageId !== prevNewestIdRef.current
    const isNewUserMessage = isNewMessageAdded && newestMessageRole === 'user'

    if (isNewUserMessage || activeTool) {
      const ref = scrollViewRefHolder.current
      if (ref) {
        followScrollToBottom(
          ref,
          isNewUserMessage ? 'new_user_message' : `active_tool:${activeTool?.name ?? 'unknown'}`
        )
      }
    }
    prevNewestIdRef.current = newestMessageId
  }, [newestMessageId, newestMessageRole, activeTool, followScrollToBottom])

  const streamingActiveEffectRef = streamingActiveRef
  useEffect(() => {
    const wasStreaming = streamingActiveEffectRef.current
    const nowStreaming = isStreaming || isStreamBridgeActive

    if (wasStreaming && !nowStreaming) {
      cancelPendingProgrammaticScroll()
      postStreamWatchUntilRef.current = Date.now() + POST_STREAM_WATCH_MS
      setAgentScrollDebugContext({ postStreamWatch: true })
      if (postStreamWatchTimerRef.current) {
        clearTimeout(postStreamWatchTimerRef.current)
      }
      const watchClearAt = postStreamWatchUntilRef.current
      postStreamWatchTimerRef.current = setTimeout(() => {
        postStreamWatchTimerRef.current = null
        if (postStreamWatchUntilRef.current === watchClearAt) {
          setAgentScrollDebugContext({ postStreamWatch: false })
        }
      }, POST_STREAM_WATCH_MS)

      logAgentScrollEvent('stream_end', {
        shouldFollow: followModeRef.current === 'following',
        ...snapshotScroll(),
        postStreamWatch: true
      })
      const metrics = lastScrollMetricsRef.current
      const wasLocked = userLockedAwayRef.current
      const away = wasLocked || !metrics || !isNearBottom(metrics)
      if (away) {
        userLockedAwayRef.current = true
        setFollowModeState('idle')
        holdContentHeightWhileAway()
        logAgentScrollEvent('stream_end_lock_away', {
          reason: !metrics ? 'no_metrics' : wasLocked ? 'already_locked' : 'not_near_bottom',
          ...snapshotScroll()
        })
      } else {
        logAgentScrollEvent('stream_end_stay_following', snapshotScroll())
      }
    } else if (!wasStreaming && nowStreaming) {
      if (!userLockedAwayRef.current) {
        releaseContentHandoff()
      }
      lastContentHeightRef.current = 0
      logAgentScrollEvent('stream_start')
    }

    streamingActiveEffectRef.current = nowStreaming
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keep deps size stable for Fast Refresh
  }, [
    isStreaming,
    isStreamBridgeActive,
    releaseContentHandoff,
    holdContentHeightWhileAway,
    snapshotScroll,
    cancelPendingProgrammaticScroll,
    setFollowModeState
  ])

  useEffect(() => {
    return () => {
      if (smoothSettleTimerRef.current) {
        clearTimeout(smoothSettleTimerRef.current)
      }
      if (postStreamWatchTimerRef.current) {
        clearTimeout(postStreamWatchTimerRef.current)
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
    cancelPendingProgrammaticScroll()
    exitFollowing()
  }, [cancelPendingProgrammaticScroll, exitFollowing])

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      lastScrollMetricsRef.current = event.nativeEvent
      lastScrollOffsetRef.current = event.nativeEvent.contentOffset.y
      isUserDraggingRef.current = false

      if (isSmoothScrollingRef.current) return
      settleFollowModeAfterGesture(event.nativeEvent)
    },
    [settleFollowModeAfterGesture]
  )

  const handleMomentumScrollBegin = useCallback(() => {
    isMomentumScrollingRef.current = true
    cancelPendingProgrammaticScroll()
    const metrics = lastScrollMetricsRef.current
    if (!metrics) return
    const intrinsicH = lastIntrinsicContentHeightRef.current
    const realH =
      intrinsicH > 0 ? Math.min(intrinsicH, metrics.contentSize.height) : metrics.contentSize.height
    if (!isNearContentBottom(metrics.contentOffset.y, realH, metrics.layoutMeasurement.height)) {
      exitFollowing()
    }
  }, [cancelPendingProgrammaticScroll, exitFollowing])

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      lastScrollMetricsRef.current = event.nativeEvent
      lastScrollOffsetRef.current = event.nativeEvent.contentOffset.y
      isMomentumScrollingRef.current = false

      if (isSmoothScrollingRef.current) return
      settleFollowModeAfterGesture(event.nativeEvent)
    },
    [settleFollowModeAfterGesture]
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
    scrollToBottomOnFocus,
    beginFollowIfAtBottom,
    handleContentSizeChange,
    handleIntrinsicContentHeightChange,
    bindFlatList
  }
}
