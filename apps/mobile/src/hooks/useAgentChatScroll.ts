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

function isNearContentBottom(
  offsetY: number,
  contentHeight: number,
  viewportHeight: number,
  threshold = BOTTOM_THRESHOLD_PX
): boolean {
  if (viewportHeight <= 0 || contentHeight <= 0) return false
  return contentHeight - offsetY - viewportHeight <= threshold
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
  /** 子内容真实高度（不含 minHeight 托底）；折叠思考后靠它收回空白 */
  const lastIntrinsicContentHeightRef = useRef(0)
  const contentAnchorMinHeightRef = useRef<number | undefined>(undefined)
  contentAnchorMinHeightRef.current = contentAnchorMinHeight
  const streamingActiveRef = useRef(isStreaming || isStreamBridgeActive)
  streamingActiveRef.current = isStreaming || isStreamBridgeActive

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

  /** 仅在流式/交接窗托底；平时离开底部绝不抬高 minHeight（靠近底部时 preserveFloor 会凭空造空白） */
  const holdContentHeightWhileAway = useCallback(() => {
    const viewportH = lastScrollMetricsRef.current?.layoutMeasurement.height ?? 0
    const offsetY = lastScrollOffsetRef.current
    const liveH = Math.max(lastIntrinsicContentHeightRef.current, lastContentHeightRef.current)
    if (liveH <= 0) return

    const watching = inPostStreamWatch()
    const streaming = streamingActiveRef.current
    // 非流式场景：最多托到当前真实高度，绝不 +threshold 造垫高
    let anchor = liveH
    if (watching || streaming) {
      const preserveFloor = viewportH > 0 ? offsetY + viewportH + BOTTOM_THRESHOLD_PX : 0
      anchor = Math.max(liveH, peakContentHeightRef.current, preserveFloor)
    }

    setContentAnchorMinHeight((prev) => {
      const next = Math.max(prev ?? 0, anchor)
      if ((prev ?? 0) < next - 1) {
        logAgentScrollEvent('content_hold_while_away', {
          anchorH: Math.round(next),
          liveH: Math.round(liveH),
          streaming,
          postStreamWatch: watching
        })
      }
      return next
    })
  }, [inPostStreamWatch])

  /** 清托底前压制随后的钳位 onScroll，避免 deltaY<0 再次 exitFollowing→hold 死循环 */
  const clearContentAnchor = useCallback(
    (reason: string, nextPeak?: number) => {
      const prev = contentAnchorMinHeightRef.current
      if (prev == null) return
      suppressInterruptRef.current += 3
      peakContentHeightRef.current = nextPeak ?? lastIntrinsicContentHeightRef.current
      setContentAnchorMinHeight(undefined)
      logAgentScrollEvent('content_anchor_clear', {
        reason,
        prevAnchor: Math.round(prev),
        ...snapshotScroll()
      })
    },
    [snapshotScroll]
  )

  /**
   * 内容变矮后收回托底：只清/收，绝不 scrollTo。
   */
  const reconcileAnchorAfterContentShrink = useCallback(
    (_scrollViewRef: RefObject<ScrollView | null>, contentHeight: number, prevHeight: number) => {
      const viewportH = lastScrollMetricsRef.current?.layoutMeasurement.height ?? 0
      const offsetY = lastScrollOffsetRef.current
      const naturalMax = Math.max(0, contentHeight - viewportH)
      const preserveFloor =
        viewportH > 0 ? Math.ceil(offsetY + viewportH + BOTTOM_THRESHOLD_PX) : contentHeight
      const watching = inPostStreamWatch()
      const currentAnchor = contentAnchorMinHeightRef.current
      if (currentAnchor == null) return

      if (!watching && currentAnchor > contentHeight + 1) {
        clearContentAnchor('reconcile_drop', contentHeight)
        logAgentScrollEvent('content_anchor_drop_safe', {
          contentH: Math.round(contentHeight),
          prevH: Math.round(prevHeight),
          offsetY: Math.round(offsetY),
          naturalMax: Math.round(naturalMax)
        })
        return
      }

      const minimalHold = Math.max(contentHeight, Math.min(currentAnchor, preserveFloor))
      const emptyPad = Math.max(0, minimalHold - contentHeight)
      peakContentHeightRef.current = Math.max(contentHeight, minimalHold)
      setContentAnchorMinHeight((prev) => {
        if (prev != null && Math.abs(prev - minimalHold) < 1) return prev
        if (prev != null && minimalHold >= prev - 1) return prev
        logAgentScrollEvent('content_anchor_reconcile_shrink', {
          prevAnchor: prev != null ? Math.round(prev) : 0,
          nextAnchor: Math.round(minimalHold),
          contentH: Math.round(contentHeight),
          prevH: Math.round(prevHeight),
          offsetY: Math.round(offsetY),
          emptyPad: Math.round(emptyPad),
          postStreamWatch: watching
        })
        return minimalHold
      })
    },
    [inPostStreamWatch, clearContentAnchor]
  )

  const releaseContentHandoff = useCallback(() => {
    const prev = contentAnchorMinHeightRef.current
    if (prev != null) {
      suppressInterruptRef.current += 3
      logAgentScrollEvent('content_handoff_end', {
        prevAnchor: Math.round(prev),
        ...snapshotScroll(),
        postStreamWatch: inPostStreamWatch()
      })
    }
    setContentAnchorMinHeight(undefined)
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

  /** 布局交接期用 minHeight 托住列表；用户离开底部时同样托住，防止输出结束回落 */
  const beginContentHandoff = useCallback(() => {
    const liveH = Math.max(lastIntrinsicContentHeightRef.current, lastContentHeightRef.current)
    const anchor = Math.max(peakContentHeightRef.current, liveH)
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

      // 上滑优先退出跟随；清托底引发的钳位用 suppress 吞掉，避免 hold↔trim 死循环
      if (deltaY < -2 || (isUserDraggingRef.current && !isNearBottom(nativeEvent))) {
        if (suppressInterruptRef.current > 0) {
          suppressInterruptRef.current -= 1
          return
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

  const handleContentSizeChange = useCallback(
    (scrollViewRef: RefObject<ScrollView | null>, contentHeight: number) => {
      const now = Date.now()
      const watching = inPostStreamWatch()
      const prevHeight = lastContentHeightRef.current
      const anchor = contentAnchorMinHeightRef.current
      // minHeight 托底时 ScrollView 回报高度会被冻在 anchor，不能当真实变矮信号
      const heightDominatedByAnchor =
        anchor != null && contentHeight + 2 >= anchor && contentHeight + 2 >= prevHeight
      const shrinking =
        !heightDominatedByAnchor &&
        contentHeight > 0 &&
        prevHeight > 0 &&
        contentHeight + 1 < prevHeight
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
          anchorMinH: anchor ?? 0,
          intrinsicH: Math.round(lastIntrinsicContentHeightRef.current),
          lockedAway: userLockedAwayRef.current,
          followMode: followModeRef.current,
          postStreamWatch: watching
        })
      }

      if (contentHeight > 0) {
        if (!heightDominatedByAnchor) {
          lastContentHeightRef.current = contentHeight
        }
        if (isStreaming || isStreamBridgeActive) {
          peakContentHeightRef.current = Math.max(
            peakContentHeightRef.current,
            lastIntrinsicContentHeightRef.current || contentHeight
          )
        }

        // 离开底部期间：仅在 ScrollView 高度真实变矮时尝试收回（多数折叠靠 intrinsic）
        if (userLockedAwayRef.current || followModeRef.current === 'idle') {
          if (shrinking) {
            const intrinsic = lastIntrinsicContentHeightRef.current
            const effectiveH =
              intrinsic > 0 && intrinsic < contentHeight - 1 ? intrinsic : contentHeight
            reconcileAnchorAfterContentShrink(scrollViewRef, effectiveH, prevHeight)
          }
          return
        }

        if (!isStreaming && !isStreamBridgeActive) {
          // 跟随态不应残留托底，否则滚到底会进空白
          if (anchor != null) {
            releaseContentHandoff()
          }
          return
        }
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
      reconcileAnchorAfterContentShrink,
      inPostStreamWatch,
      releaseContentHandoff
    ]
  )

  /** 子树真实高度变化（折叠思考等）；不受 contentContainerStyle.minHeight 影响 */
  const handleIntrinsicContentHeightChange = useCallback(
    (intrinsicHeight: number) => {
      if (intrinsicHeight <= 0) return
      const prevIntrinsic = lastIntrinsicContentHeightRef.current
      if (prevIntrinsic > 0 && Math.abs(intrinsicHeight - prevIntrinsic) < 1) return

      lastIntrinsicContentHeightRef.current = intrinsicHeight
      if (isStreaming || isStreamBridgeActive) {
        peakContentHeightRef.current = Math.max(peakContentHeightRef.current, intrinsicHeight)
      }

      const ref = scrollViewRefHolder.current
      const away = userLockedAwayRef.current || followModeRef.current === 'idle'
      const anchor = contentAnchorMinHeightRef.current

      if (!away) {
        if (anchor != null && intrinsicHeight + 1 < anchor) {
          releaseContentHandoff()
        }
        return
      }

      if (anchor != null && intrinsicHeight + 1 < anchor) {
        if (ref) {
          reconcileAnchorAfterContentShrink(ref, intrinsicHeight, prevIntrinsic || anchor)
        } else if (!inPostStreamWatch()) {
          peakContentHeightRef.current = intrinsicHeight
          setContentAnchorMinHeight(undefined)
          logAgentScrollEvent('content_anchor_drop_safe', {
            prevAnchor: Math.round(anchor),
            contentH: Math.round(intrinsicHeight),
            reason: 'intrinsic_no_ref'
          })
        }
      }
    },
    [
      isStreaming,
      isStreamBridgeActive,
      reconcileAnchorAfterContentShrink,
      releaseContentHandoff,
      inPostStreamWatch
    ]
  )

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

  const settleFollowModeAfterGesture = useCallback(
    (nativeEvent: NativeScrollEvent) => {
      const offsetY = nativeEvent.contentOffset.y
      const viewportH = nativeEvent.layoutMeasurement.height
      const liveH = Math.max(
        lastIntrinsicContentHeightRef.current,
        lastContentHeightRef.current
      )
      const realH = liveH > 0 ? liveH : nativeEvent.contentSize.height
      const anchor = contentAnchorMinHeightRef.current

      // 非流式残留托底：清掉。不调用 exitFollowing，避免再次 hold。
      if (
        anchor != null &&
        liveH > 0 &&
        anchor > liveH + 1 &&
        !streamingActiveRef.current &&
        !inPostStreamWatch()
      ) {
        clearContentAnchor('settle_trim', liveH)
      }

      if (isNearContentBottom(offsetY, realH, viewportH)) {
        enterFollowing()
        releaseContentHandoff()
        return
      }

      userLockedAwayRef.current = true
      if (followModeRef.current !== 'idle') {
        setFollowModeState('idle')
      }
    },
    [enterFollowing, releaseContentHandoff, clearContentAnchor, inPostStreamWatch, setFollowModeState]
  )

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
      intrinsicH > 0
        ? Math.min(intrinsicH, metrics.contentSize.height)
        : metrics.contentSize.height
    if (
      !isNearContentBottom(
        metrics.contentOffset.y,
        realH,
        metrics.layoutMeasurement.height
      )
    ) {
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
