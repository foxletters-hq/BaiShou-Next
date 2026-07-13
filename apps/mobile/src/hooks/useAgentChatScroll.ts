import { useState, useRef, useEffect, useCallback, type RefObject } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native'
import {
  logAgentScrollEvent,
  setAgentScrollDebugContext,
  type AgentScrollSnapshot
} from '../utils/agent-scroll-diagnostics'

const BOTTOM_THRESHOLD_PX = 48
/** 输出结束后短窗：此间任何程序化贴底 / 大幅跳底都标红排查 */
const POST_STREAM_WATCH_MS = 2500
/** 无用户拖拽时，offset 朝底部跳变超过此值视为钳位嫌疑 */
const SUSPECT_CLAMP_DELTA_PX = 40

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
  const [contentAnchorMinHeight, setContentAnchorMinHeight] = useState<number | undefined>(
    undefined
  )
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

  const snapshotScroll = useCallback((): AgentScrollSnapshot => {
    const metrics = lastScrollMetricsRef.current
    const contentH = metrics?.contentSize.height ?? lastContentHeightRef.current
    const viewportH = metrics?.layoutMeasurement.height ?? 0
    const offsetY = lastScrollOffsetRef.current
    const maxOffset = Math.max(0, contentH - viewportH)
    return {
      offsetY: Math.round(offsetY),
      contentH: Math.round(contentH),
      viewportH: Math.round(viewportH),
      maxOffset: Math.round(maxOffset),
      nearBottom: metrics ? isNearBottom(metrics) : undefined,
      lockedAway: userLockedAwayRef.current,
      followMode: followModeRef.current,
      anchorMinH: contentAnchorMinHeight != null ? Math.round(contentAnchorMinHeight) : 0,
      peakContentH: Math.round(peakContentHeightRef.current)
    }
  }, [contentAnchorMinHeight])

  const inPostStreamWatch = useCallback(() => Date.now() < postStreamWatchUntilRef.current, [])

  const setFollowModeState = useCallback((mode: ScrollFollowMode) => {
    if (followModeRef.current === mode) return
    followModeRef.current = mode
    setFollowMode(mode)
    setShowScrollButton(mode === 'idle')
    setAgentScrollDebugContext({ followMode: mode })
  }, [])

  /** 离开底部时托住当前内容高度，避免流式尾部消失/交接回落把 offset 钳到最底 */
  const holdContentHeightWhileAway = useCallback(() => {
    const anchor = Math.max(peakContentHeightRef.current, lastContentHeightRef.current)
    if (anchor <= 0) return
    setContentAnchorMinHeight((prev) => {
      const next = Math.max(prev ?? 0, anchor)
      if ((prev ?? 0) < next - 1) {
        logAgentScrollEvent('content_hold_while_away', { anchorH: Math.round(next) })
      }
      return next
    })
  }, [])

  const releaseContentHandoff = useCallback(() => {
    setContentAnchorMinHeight((prev) => {
      if (prev != null) {
        logAgentScrollEvent('content_handoff_end', {
          prevAnchor: Math.round(prev),
          ...snapshotScroll(),
          postStreamWatch: inPostStreamWatch()
        })
      }
      return undefined
    })
    peakContentHeightRef.current = 0
  }, [snapshotScroll, inPostStreamWatch])

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
    // 关键关键勿清托底：清掉 minHeight 会让内容变矮，ScrollView 把 offset 钳回底部（正是「拽到底」）
    holdContentHeightWhileAway()
  }, [setFollowModeState, cancelPendingProgrammaticScroll, holdContentHeightWhileAway])

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

  /** 布局交接期用 minHeight 托住列表；用户离开底部时同样托住，防止输出结束回落 */
  const beginContentHandoff = useCallback(() => {
    const anchor = Math.max(peakContentHeightRef.current, lastContentHeightRef.current)
    if (anchor <= 0) return

    setContentAnchorMinHeight((prev) => {
      const next = Math.max(prev ?? 0, anchor)
      if ((prev ?? 0) < next - 1) {
        logAgentScrollEvent('content_handoff_begin', {
          anchorH: Math.round(next),
          lockedAway: userLockedAwayRef.current
        })
      }
      return next
    })
  }, [])

  /** 只释放托底，不做任何 scroll —— 用户已离开底部时推迟释放 */
  const finalizeContentHandoff = useCallback(() => {
    if (userLockedAwayRef.current || followModeRef.current === 'idle') {
      logAgentScrollEvent('content_handoff_defer_release', {
        lockedAway: userLockedAwayRef.current,
        followMode: followModeRef.current,
        ...snapshotScroll(),
        postStreamWatch: inPostStreamWatch()
      })
      holdContentHeightWhileAway()
      return
    }
    logAgentScrollEvent('content_handoff_release', {
      ...snapshotScroll(),
      postStreamWatch: inPostStreamWatch()
    })
    releaseContentHandoff()
  }, [releaseContentHandoff, holdContentHeightWhileAway, snapshotScroll, inPostStreamWatch])

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
      const nativeEvent = event.nativeEvent
      lastScrollMetricsRef.current = nativeEvent
      const offsetY = nativeEvent.contentOffset.y
      const prevOffsetY = lastScrollOffsetRef.current
      const deltaY = offsetY - prevOffsetY
      lastScrollOffsetRef.current = offsetY

      const contentH = nativeEvent.contentSize.height
      const viewportH = nativeEvent.layoutMeasurement.height
      const maxOffset = Math.max(0, contentH - viewportH)
      const distanceFromBottom = maxOffset - offsetY
      const wasAwayFromBottom = prevOffsetY < maxOffset - BOTTOM_THRESHOLD_PX
      const nowNearBottom = distanceFromBottom <= BOTTOM_THRESHOLD_PX
      const msSinceProgrammatic = Date.now() - lastProgrammaticScrollAtRef.current
      const watching = inPostStreamWatch()

      // 无用户拖拽时大幅朝底部跳：RN 钳位或程序化 scrollToEnd
      if (
        !isUserDraggingRef.current &&
        deltaY > SUSPECT_CLAMP_DELTA_PX &&
        (watching || userLockedAwayRef.current || followModeRef.current === 'idle') &&
        (wasAwayFromBottom || watching) &&
        nowNearBottom
      ) {
        logAgentScrollEvent('suspect_clamp_to_bottom', {
          fromY: Math.round(prevOffsetY),
          toY: Math.round(offsetY),
          deltaY: Math.round(deltaY),
          contentH: Math.round(contentH),
          maxOffset: Math.round(maxOffset),
          msSinceProgrammatic,
          lastProgrammaticReason: lastProgrammaticReasonRef.current,
          suppressLeft: suppressInterruptRef.current,
          postStreamWatch: watching,
          lockedAway: userLockedAwayRef.current,
          followMode: followModeRef.current
        })
      } else if (watching && Math.abs(deltaY) > 8) {
        logAgentScrollEvent('scroll_during_post_stream', {
          fromY: Math.round(prevOffsetY),
          toY: Math.round(offsetY),
          deltaY: Math.round(deltaY),
          maxOffset: Math.round(maxOffset),
          dragging: isUserDraggingRef.current,
          msSinceProgrammatic,
          lastProgrammaticReason: lastProgrammaticReasonRef.current,
          lockedAway: userLockedAwayRef.current,
          followMode: followModeRef.current
        })
      }

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
          contentH: Math.round(contentH),
          viewportH: Math.round(viewportH),
          deltaY: Math.round(deltaY)
        })
      }

      // 上滑优先退出跟随，不被 programmatic suppress 吞掉
      if (deltaY < -2 || (isUserDraggingRef.current && !isNearBottom(nativeEvent))) {
        if (suppressInterruptRef.current > 0) {
          suppressInterruptRef.current = 0
        }
        exitFollowing()
        return
      }

      if (isSmoothScrollingRef.current) return

      if (suppressInterruptRef.current > 0) {
        suppressInterruptRef.current -= 1
        return
      }

      // 对齐桌面：onScroll 只负责退出跟随，不因「刚好贴底」自动解锁。
      // 内容变矮时 offset 会被钳到新底部，若在此处 enterFollowing，后续仍可能被拽走。
      if (isNearBottom(nativeEvent)) {
        return
      }

      if (userLockedAwayRef.current) return

      exitFollowing()
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

  const handleContentSizeChange = useCallback(
    (scrollViewRef: RefObject<ScrollView | null>, contentHeight: number) => {
      const now = Date.now()
      const watching = inPostStreamWatch()
      const prevHeight = lastContentHeightRef.current
      const shrinking = contentHeight > 0 && prevHeight > 0 && contentHeight + 1 < prevHeight
      const shouldLog =
        watching || shrinking || now - contentResizeLogThrottleRef.current > 400

      if (shouldLog) {
        contentResizeLogThrottleRef.current = now
        const metrics = lastScrollMetricsRef.current
        const viewportH = metrics?.layoutMeasurement.height ?? 0
        const maxOffset = Math.max(0, contentHeight - viewportH)
        logAgentScrollEvent(shrinking ? 'content_size_shrink' : 'content_size', {
          contentH: Math.round(contentHeight),
          prevH: Math.round(prevHeight),
          offsetY: Math.round(lastScrollOffsetRef.current),
          maxOffset: Math.round(maxOffset),
          streaming: isStreaming || isStreamBridgeActive,
          anchorMinH: contentAnchorMinHeight ?? 0,
          lockedAway: userLockedAwayRef.current,
          followMode: followModeRef.current,
          postStreamWatch: watching
        })
      }

      if (contentHeight > 0) {
        lastContentHeightRef.current = contentHeight
        if (isStreaming || isStreamBridgeActive) {
          peakContentHeightRef.current = Math.max(peakContentHeightRef.current, contentHeight)
        }

        // 离开底部期间内容变矮：托住高度并钉住 offset，防止系统钳到底部
        if (userLockedAwayRef.current || followModeRef.current === 'idle') {
          if (contentHeight + 1 < prevHeight) {
            peakContentHeightRef.current = Math.max(peakContentHeightRef.current, prevHeight)
            holdContentHeightWhileAway()
            const viewportH = lastScrollMetricsRef.current?.layoutMeasurement.height ?? 0
            // 用托底后的有效高度计算，避免先钳到矮内容底部
            const heldH = Math.max(contentHeight, peakContentHeightRef.current)
            const maxOffset = Math.max(0, heldH - viewportH)
            const target = Math.min(lastScrollOffsetRef.current, maxOffset)
            if (
              scrollViewRef.current &&
              target < lastScrollOffsetRef.current - 1 &&
              heldH <= contentHeight + 1
            ) {
              // 仅在托底未能生效、确实被钳位时钉住
              lastProgrammaticScrollAtRef.current = Date.now()
              lastProgrammaticReasonRef.current = 'pin_offset_on_shrink'
              logAgentScrollEvent('pin_offset_on_shrink', {
                fromY: Math.round(lastScrollOffsetRef.current),
                toY: Math.round(target),
                prevH: Math.round(prevHeight),
                nextH: Math.round(contentHeight),
                heldH: Math.round(heldH),
                postStreamWatch: watching
              })
              suppressInterruptRef.current += 1
              scrollViewRef.current.scrollTo({ y: target, animated: false })
              lastScrollOffsetRef.current = target
            }
          }
          return
        }

        if (!isStreaming && !isStreamBridgeActive) return
        if (followModeRef.current !== 'following') return
        if (!scrollViewRef.current) return
        if (Math.abs(contentHeight - prevHeight) < 1) return
        if (streamingFollowRafRef.current != null) return

        streamingFollowRafRef.current = requestAnimationFrame(() => {
          streamingFollowRafRef.current = null
          if (userLockedAwayRef.current) return
          if (followModeRef.current !== 'following') return
          jumpToBottomInstant(scrollViewRef, 'content_size_follow')
        })
      }
    },
    [
      isStreaming,
      isStreamBridgeActive,
      jumpToBottomInstant,
      contentAnchorMinHeight,
      holdContentHeightWhileAway,
      inPostStreamWatch
    ]
  )

  const streamingActiveRef = useRef(isStreaming || isStreamBridgeActive)
  useEffect(() => {
    const wasStreaming = streamingActiveRef.current
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
      // 输出结束：用户曾离开底部则保持离开锁，并继续托住高度（绝不 clearAnchor）
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

    streamingActiveRef.current = nowStreaming
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
      // 用户手势结束且停在底部：才解除离开锁并释放托底
      if (isNearBottom(event.nativeEvent)) {
        enterFollowing()
        releaseContentHandoff()
        return
      }
      exitFollowing()
    },
    [enterFollowing, exitFollowing, releaseContentHandoff]
  )

  const handleMomentumScrollBegin = useCallback(() => {
    isMomentumScrollingRef.current = true
    cancelPendingProgrammaticScroll()
    const metrics = lastScrollMetricsRef.current
    if (metrics && !isNearBottom(metrics)) {
      exitFollowing()
    }
  }, [cancelPendingProgrammaticScroll, exitFollowing])

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      lastScrollMetricsRef.current = event.nativeEvent
      lastScrollOffsetRef.current = event.nativeEvent.contentOffset.y
      isMomentumScrollingRef.current = false

      if (isSmoothScrollingRef.current) return
      if (isNearBottom(event.nativeEvent)) {
        enterFollowing()
        releaseContentHandoff()
        return
      }
      exitFollowing()
    },
    [enterFollowing, exitFollowing, releaseContentHandoff]
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
    bindFlatList
  }
}
