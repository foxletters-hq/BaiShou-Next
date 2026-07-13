import { useState, useCallback, type MutableRefObject, type RefObject } from 'react'
import type { NativeScrollEvent, ScrollView } from 'react-native'
import { logAgentScrollEvent, type AgentScrollSnapshot } from '../utils/agent-scroll-diagnostics'
import {
  BOTTOM_THRESHOLD_PX,
  isNearContentBottom,
  type ScrollFollowMode
} from './agent-chat-scroll.helpers'

/* refs 经参数传入后 exhaustive-deps 会误报；deps 与拆分前 monolith 保持一致 */
/* eslint-disable react-hooks/exhaustive-deps */

export interface UseAgentChatScrollAnchorParams {
  userLockedAwayRef: MutableRefObject<boolean>
  followModeRef: MutableRefObject<ScrollFollowMode>
  lastScrollMetricsRef: MutableRefObject<NativeScrollEvent | null>
  lastScrollOffsetRef: MutableRefObject<number>
  lastContentHeightRef: MutableRefObject<number>
  lastIntrinsicContentHeightRef: MutableRefObject<number>
  peakContentHeightRef: MutableRefObject<number>
  contentAnchorMinHeightRef: MutableRefObject<number | undefined>
  streamingActiveRef: MutableRefObject<boolean>
  suppressInterruptRef: MutableRefObject<number>
  contentResizeLogThrottleRef: MutableRefObject<number>
  streamingFollowRafRef: MutableRefObject<number | null>
  scrollViewRefHolder: MutableRefObject<RefObject<ScrollView | null> | null>
  isStreaming: boolean
  isStreamBridgeActive: boolean
  inPostStreamWatch: () => boolean
  snapshotScroll: () => AgentScrollSnapshot
  jumpToBottomInstantRef: MutableRefObject<
    (scrollViewRef: RefObject<ScrollView | null>, reason?: string) => void
  >
  enterFollowingRef: MutableRefObject<() => void>
  setFollowModeStateRef: MutableRefObject<(mode: ScrollFollowMode) => void>
}

/**
 * 内容托底（minHeight）与内容高度变化相关逻辑。
 */
export function useAgentChatScrollAnchor({
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
}: UseAgentChatScrollAnchorParams) {
  const [contentAnchorMinHeight, setContentAnchorMinHeight] = useState<number | undefined>(
    undefined
  )
  contentAnchorMinHeightRef.current = contentAnchorMinHeight

  /** 仅在流式/交接窗托底；平时离开底部绝不抬高 minHeight（靠近底部时 preserveFloor 会凭空造空白） */
  const holdContentHeightWhileAway = useCallback(() => {
    const viewportH = lastScrollMetricsRef.current?.layoutMeasurement.height ?? 0
    const offsetY = lastScrollOffsetRef.current
    const liveH = Math.max(lastIntrinsicContentHeightRef.current, lastContentHeightRef.current)
    if (liveH <= 0) return

    const watching = inPostStreamWatch()
    const streaming = streamingActiveRef.current
    // 非流式：最多托到真实高度。
    // 流式/交接窗：只保「当前视口底边」= offset+viewport，绝不 +threshold，也绝不用过高的 peak
    //（peak>live 会在底部造出可滚空白，清掉时又被钳回）。
    let anchor = liveH
    if (watching || streaming) {
      const preserveFloor = viewportH > 0 ? offsetY + viewportH : 0
      anchor = Math.max(liveH, preserveFloor)
    }

    setContentAnchorMinHeight((prev) => {
      const next = Math.max(prev ?? 0, anchor)
      if ((prev ?? 0) < next - 1) {
        logAgentScrollEvent('content_hold_while_away', {
          anchorH: Math.round(next),
          liveH: Math.round(liveH),
          preserveFloor:
            watching || streaming
              ? Math.round(viewportH > 0 ? offsetY + viewportH : 0)
              : Math.round(liveH),
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
      // 与 hold 一致：只保到视口底边，不加 threshold，避免造出可滚空白
      const preserveFloor = viewportH > 0 ? Math.ceil(offsetY + viewportH) : contentHeight
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
      const shouldLog = watching || shrinking || now - contentResizeLogThrottleRef.current > 400

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
          jumpToBottomInstantRef.current(scrollViewRef, 'content_size_follow')
        })
      }
    },
    [
      isStreaming,
      isStreamBridgeActive,
      jumpToBottomInstantRef,
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

  const settleFollowModeAfterGesture = useCallback(
    (nativeEvent: NativeScrollEvent) => {
      const offsetY = nativeEvent.contentOffset.y
      const viewportH = nativeEvent.layoutMeasurement.height
      const liveH = Math.max(lastIntrinsicContentHeightRef.current, lastContentHeightRef.current)
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

      // 用真实内容判贴底。offset 已越过真实内容底 = 落在托底空白里：
      // 绝不能 enterFollowing + release（会钳位拽回）；微小假垫高可清，大托底留给 reconcile。
      const naturalMax = Math.max(0, realH - viewportH)
      const emptyPad = anchor != null && realH > 0 ? Math.max(0, (anchor as number) - realH) : 0
      if (realH > 0 && offsetY > naturalMax + 1) {
        userLockedAwayRef.current = true
        if (followModeRef.current !== 'idle') {
          setFollowModeStateRef.current('idle')
        }
        if (emptyPad > 1 && emptyPad <= BOTTOM_THRESHOLD_PX + 8) {
          clearContentAnchor('settle_tiny_pad', realH)
        }
        return
      }

      if (isNearContentBottom(offsetY, realH, viewportH)) {
        enterFollowingRef.current()
        releaseContentHandoff()
        return
      }

      userLockedAwayRef.current = true
      if (followModeRef.current !== 'idle') {
        setFollowModeStateRef.current('idle')
      }
    },
    [
      enterFollowingRef,
      releaseContentHandoff,
      clearContentAnchor,
      inPostStreamWatch,
      setFollowModeStateRef
    ]
  )

  return {
    contentAnchorMinHeight,
    setContentAnchorMinHeight,
    holdContentHeightWhileAway,
    clearContentAnchor,
    reconcileAnchorAfterContentShrink,
    releaseContentHandoff,
    beginContentHandoff,
    finalizeContentHandoff,
    handleContentSizeChange,
    handleIntrinsicContentHeightChange,
    settleFollowModeAfterGesture
  }
}
