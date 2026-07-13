import type { MutableRefObject } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { logAgentScrollEvent } from '../utils/agent-scroll-diagnostics'

export const BOTTOM_THRESHOLD_PX = 48
/** 输出结束后短窗：此间任何程序化贴底 / 大幅跳底都标红排查 */
export const POST_STREAM_WATCH_MS = 2500
/** 无用户拖拽时，offset 朝底部跳变超过此值视为钳位嫌疑 */
export const SUSPECT_CLAMP_DELTA_PX = 40

export type ScrollFollowMode = 'following' | 'idle'

export interface UseAgentChatScrollParams {
  sessionId: string | null
  messages: Array<{ id?: string; role?: string }>
  isStreaming: boolean
  isStreamBridgeActive: boolean
  activeTool: { name: string } | null
}

export function isNearBottom(
  nativeEvent: NativeScrollEvent,
  threshold = BOTTOM_THRESHOLD_PX
): boolean {
  const { contentOffset, contentSize, layoutMeasurement } = nativeEvent
  return contentSize.height - contentOffset.y - layoutMeasurement.height <= threshold
}

export function isNearContentBottom(
  offsetY: number,
  contentHeight: number,
  viewportHeight: number,
  threshold = BOTTOM_THRESHOLD_PX
): boolean {
  if (viewportHeight <= 0 || contentHeight <= 0) return false
  return contentHeight - offsetY - viewportHeight <= threshold
}

export interface AgentChatListScrollHandlerDeps {
  lastScrollMetricsRef: MutableRefObject<NativeScrollEvent | null>
  lastScrollOffsetRef: MutableRefObject<number>
  lastProgrammaticScrollAtRef: MutableRefObject<number>
  lastProgrammaticReasonRef: MutableRefObject<string | null>
  isUserDraggingRef: MutableRefObject<boolean>
  isSmoothScrollingRef: MutableRefObject<boolean>
  userLockedAwayRef: MutableRefObject<boolean>
  followModeRef: MutableRefObject<ScrollFollowMode>
  suppressInterruptRef: MutableRefObject<number>
  inPostStreamWatch: () => boolean
  exitFollowing: () => void
}

/** onScroll：诊断钳位/跳顶，并在上滑时退出跟随 */
export function handleAgentChatListScroll(
  event: NativeSyntheticEvent<NativeScrollEvent>,
  deps: AgentChatListScrollHandlerDeps
): void {
  const {
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
  } = deps

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
}
