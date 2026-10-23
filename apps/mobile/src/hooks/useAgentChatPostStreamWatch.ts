import { useEffect, type MutableRefObject } from 'react'
import type { NativeScrollEvent } from 'react-native'
import {
  logAgentScrollEvent,
  setAgentScrollDebugContext,
  type AgentScrollSnapshot
} from '../utils/agent-scroll-diagnostics'
import {
  POST_STREAM_WATCH_MS,
  isNearBottom,
  type ScrollFollowMode
} from './agent-chat-scroll.helpers'

type PostStreamWatchOptions = {
  isStreaming: boolean
  isStreamBridgeActive: boolean
  streamingActiveRef: MutableRefObject<boolean>
  postStreamWatchUntilRef: MutableRefObject<number>
  postStreamWatchTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>
  lastScrollMetricsRef: MutableRefObject<NativeScrollEvent | null>
  userLockedAwayRef: MutableRefObject<boolean>
  followModeRef: MutableRefObject<ScrollFollowMode>
  snapshotScroll: () => AgentScrollSnapshot
  cancelPendingProgrammaticScroll: () => void
  holdContentHeightWhileAway: () => void
  releaseContentHandoff: () => void
  lastContentHeightRef: MutableRefObject<number>
  smoothSettleTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>
  contentFollowRafRef: MutableRefObject<number | null>
  streamingFollowRafRef: MutableRefObject<number | null>
  setFollowModeState: (mode: ScrollFollowMode) => void
}

/**
 * 输出结束后的短窗观察：判断停在底部还是离开底部，
 * 并在流式开始时释放交接态、重置内容高度。
 */
export function useAgentChatPostStreamWatch({
  isStreaming,
  isStreamBridgeActive,
  streamingActiveRef,
  postStreamWatchUntilRef,
  postStreamWatchTimerRef,
  lastScrollMetricsRef,
  userLockedAwayRef,
  followModeRef,
  snapshotScroll,
  cancelPendingProgrammaticScroll,
  holdContentHeightWhileAway,
  releaseContentHandoff,
  lastContentHeightRef,
  smoothSettleTimerRef,
  contentFollowRafRef,
  streamingFollowRafRef,
  setFollowModeState
}: PostStreamWatchOptions) {
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
    cancelPendingProgrammaticScroll,
    holdContentHeightWhileAway,
    snapshotScroll,
    setFollowModeState
  ])

  // 卸载时清掉跟随用的定时器与动画帧
  /* eslint-disable react-hooks/exhaustive-deps -- 卸载清理必须读取 ref 的最新值 */
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
  }, [contentFollowRafRef, postStreamWatchTimerRef, smoothSettleTimerRef, streamingFollowRafRef])
  /* eslint-enable react-hooks/exhaustive-deps */
}
