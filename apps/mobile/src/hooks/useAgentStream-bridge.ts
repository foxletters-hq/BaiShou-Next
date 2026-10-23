import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type SetStateAction
} from 'react'
import { useAgentStore } from '@baishou/store'
import { isAnyAgentMarkdownRevealing, stopAllAgentMarkdownRevealing } from '@baishou/ui/native'

import {
  appendTimelineReasoning,
  appendTimelineText,
  appendTimelineToolStart,
  completeTimelineTool,
  createRafBatchedCallback,
  type AgentStreamTimelineItem
} from '@baishou/shared'
import {
  STREAM_BUFFER_HOLD_AFTER_LINGER_MS,
  STREAM_PRESENTATION_LINGER_MS,
  type AgentStreamRefs,
  type ToolCallInfo
} from './useAgentStream-types'
import { reuseEmptyAgentList } from './useAgentStream.util'

interface UseAgentStreamBridgeOptions {
  refs: AgentStreamRefs
  setIsStreaming: (value: boolean) => void
  setIsCompressing: (value: boolean) => void
  setCompressionText: (value: string) => void
  setCompressionReasoning: (value: string) => void
  setCompressionTriggerMessageId: (value: string | null) => void
  setActiveTool: (value: ToolCallInfo | null) => void
  setCompletedTools: Dispatch<SetStateAction<ToolCallInfo[]>>
  setPendingEmojis: Dispatch<SetStateAction<{ emojiId: string }[]>>
  setTimeline: Dispatch<SetStateAction<AgentStreamTimelineItem[]>>
}

export function useAgentStreamBridge({
  refs,
  setIsStreaming,
  setIsCompressing,
  setCompressionText,
  setCompressionReasoning,
  setCompressionTriggerMessageId,
  setActiveTool,
  setCompletedTools,
  setPendingEmojis,
  setTimeline
}: UseAgentStreamBridgeOptions) {
  const { setLoading } = useAgentStore()

  const [isStreamBridgeActive, setIsStreamBridgeActive] = useState(false)
  const [streamPresentationLinger, setStreamPresentationLinger] = useState(false)

  const {
    isStreamingRef,
    isStreamBridgeActiveRef,
    streamPresentationLingerRef,
    completedToolsCountRef,
    streamingTextDisplayRef,
    streamingReasoningDisplayRef,
    compressionTextDisplayRef,
    compressionReasoningDisplayRef,
    streamBridgeReleaseTimerRef,
    streamPresentationLingerTimerRef,
    streamBufferHoldTimerRef,
    streamAbortRef,
    activeToolRef,
    timelineRef,
    finishStreamPassRef,
    userStoppedStreamRef,
    currentSessionIdRef
  } = refs

  useEffect(() => {
    isStreamBridgeActiveRef.current = isStreamBridgeActive
  }, [isStreamBridgeActive, isStreamBridgeActiveRef])

  useEffect(() => {
    streamPresentationLingerRef.current = streamPresentationLinger
  }, [streamPresentationLinger, streamPresentationLingerRef])

  const hasStreamOutput = useCallback(() => {
    return (
      Boolean(streamingTextDisplayRef.current?.getFullText().trim()) ||
      Boolean(streamingReasoningDisplayRef.current?.getFullText().trim()) ||
      Boolean(activeToolRef.current) ||
      completedToolsCountRef.current > 0 ||
      timelineRef.current.length > 0
    )
  }, [
    streamingTextDisplayRef,
    streamingReasoningDisplayRef,
    activeToolRef,
    completedToolsCountRef,
    timelineRef
  ])

  const isActiveSession = useCallback(
    (sessionId: string) => currentSessionIdRef.current === sessionId,
    [currentSessionIdRef]
  )

  const timelineBatchedPublisherRef = useRef(
    createRafBatchedCallback((next: AgentStreamTimelineItem[]) => {
      setTimeline(next)
    })
  )

  const publishTimeline = useCallback(() => {
    timelineBatchedPublisherRef.current.schedule(timelineRef.current.slice())
  }, [timelineRef])

  const flushTimelineNow = useCallback(() => {
    timelineBatchedPublisherRef.current.flush()
    setTimeline(timelineRef.current.slice())
  }, [setTimeline, timelineRef])

  const resetTimeline = useCallback(() => {
    timelineBatchedPublisherRef.current.flush()
    timelineRef.current = []
    setTimeline([])
  }, [setTimeline, timelineRef])

  const clearStreamingDisplayBuffers = useCallback(() => {
    streamingTextDisplayRef.current?.reset()
    streamingReasoningDisplayRef.current?.reset()
    resetTimeline()
  }, [streamingTextDisplayRef, streamingReasoningDisplayRef, resetTimeline])

  const flushStreamingDisplayBuffers = useCallback(() => {
    streamingTextDisplayRef.current?.flush()
    streamingReasoningDisplayRef.current?.flush()
    flushTimelineNow()
  }, [streamingTextDisplayRef, streamingReasoningDisplayRef, flushTimelineNow])

  const appendStreamingTextDelta = useCallback(
    (chunk: string) => {
      appendTimelineText(timelineRef.current, chunk)
      streamingTextDisplayRef.current?.push(chunk)
      publishTimeline()
    },
    [streamingTextDisplayRef, timelineRef, publishTimeline]
  )

  const appendStreamingReasoningDelta = useCallback(
    (chunk: string) => {
      appendTimelineReasoning(timelineRef.current, chunk)
      streamingReasoningDisplayRef.current?.push(chunk)
      publishTimeline()
    },
    [streamingReasoningDisplayRef, timelineRef, publishTimeline]
  )

  const resetCompressionDisplayBuffers = useCallback(() => {
    compressionTextDisplayRef.current?.reset()
    compressionReasoningDisplayRef.current?.reset()
  }, [compressionTextDisplayRef, compressionReasoningDisplayRef])

  const flushCompressionDisplayBuffers = useCallback(() => {
    compressionTextDisplayRef.current?.flush()
    compressionReasoningDisplayRef.current?.flush()
  }, [compressionTextDisplayRef, compressionReasoningDisplayRef])

  const appendCompressionTextDelta = useCallback(
    (chunk: string) => {
      compressionTextDisplayRef.current?.push(chunk)
    },
    [compressionTextDisplayRef]
  )

  const appendCompressionReasoningDelta = useCallback(
    (chunk: string) => {
      compressionReasoningDisplayRef.current?.push(chunk)
    },
    [compressionReasoningDisplayRef]
  )

  const resetCompressionBuffers = useCallback(() => {
    resetCompressionDisplayBuffers()
  }, [resetCompressionDisplayBuffers])

  const clearCompletedTools = useCallback(() => {
    setCompletedTools(reuseEmptyAgentList)
  }, [setCompletedTools])

  const clearPendingEmojis = useCallback(() => {
    setPendingEmojis(reuseEmptyAgentList)
  }, [setPendingEmojis])

  const stopStreamingUiImmediately = useCallback(() => {
    if (streamBridgeReleaseTimerRef.current) {
      clearTimeout(streamBridgeReleaseTimerRef.current)
      streamBridgeReleaseTimerRef.current = null
    }
    if (streamPresentationLingerTimerRef.current) {
      clearTimeout(streamPresentationLingerTimerRef.current)
      streamPresentationLingerTimerRef.current = null
    }
    if (streamBufferHoldTimerRef.current) {
      clearTimeout(streamBufferHoldTimerRef.current)
      streamBufferHoldTimerRef.current = null
    }
    setStreamPresentationLinger(false)
    stopAllAgentMarkdownRevealing()
    streamAbortRef.current?.()
    streamAbortRef.current = null
    isStreamingRef.current = false
    setIsStreaming(false)
    setIsStreamBridgeActive(false)
    setIsCompressing(false)
    setLoading(false)
    activeToolRef.current = null
    setActiveTool(null)
    clearCompletedTools()
    resetCompressionBuffers()
    setCompressionText('')
    setCompressionReasoning('')
    setCompressionTriggerMessageId(null)
    clearStreamingDisplayBuffers()
  }, [
    streamBridgeReleaseTimerRef,
    streamPresentationLingerTimerRef,
    streamBufferHoldTimerRef,
    streamAbortRef,
    isStreamingRef,
    setIsStreaming,
    setIsCompressing,
    setLoading,
    activeToolRef,
    setActiveTool,
    clearCompletedTools,
    resetCompressionBuffers,
    setCompressionText,
    setCompressionReasoning,
    setCompressionTriggerMessageId,
    clearStreamingDisplayBuffers
  ])

  const resetStreamingBuffers = useCallback(() => {
    clearStreamingDisplayBuffers()
    activeToolRef.current = null
    setActiveTool(null)
    clearCompletedTools()
    clearPendingEmojis()
  }, [
    clearStreamingDisplayBuffers,
    activeToolRef,
    setActiveTool,
    clearCompletedTools,
    clearPendingEmojis
  ])

  const releaseStreamBridge = useCallback(() => {
    if (streamBridgeReleaseTimerRef.current) {
      clearTimeout(streamBridgeReleaseTimerRef.current)
      streamBridgeReleaseTimerRef.current = null
    }
    setIsStreamBridgeActive(false)
    setStreamPresentationLinger(true)
    if (streamPresentationLingerTimerRef.current) {
      clearTimeout(streamPresentationLingerTimerRef.current)
    }
    if (streamBufferHoldTimerRef.current) {
      clearTimeout(streamBufferHoldTimerRef.current)
      streamBufferHoldTimerRef.current = null
    }
    const finishLingerWhenRevealDone = () => {
      if (isAnyAgentMarkdownRevealing()) {
        streamPresentationLingerTimerRef.current = setTimeout(finishLingerWhenRevealDone, 60)
        return
      }
      streamPresentationLingerTimerRef.current = null
      setStreamPresentationLinger(false)
      streamBufferHoldTimerRef.current = setTimeout(() => {
        streamBufferHoldTimerRef.current = null
        resetStreamingBuffers()
      }, STREAM_BUFFER_HOLD_AFTER_LINGER_MS + 260)
    }
    streamPresentationLingerTimerRef.current = setTimeout(
      finishLingerWhenRevealDone,
      STREAM_PRESENTATION_LINGER_MS
    )
  }, [
    streamBridgeReleaseTimerRef,
    streamPresentationLingerTimerRef,
    streamBufferHoldTimerRef,
    resetStreamingBuffers
  ])

  const beginStreamBridgeHandoff = useCallback(() => {
    if (streamBridgeReleaseTimerRef.current) {
      clearTimeout(streamBridgeReleaseTimerRef.current)
    }
    if (userStoppedStreamRef.current) {
      streamBridgeReleaseTimerRef.current = null
      setIsStreamBridgeActive(false)
      setStreamPresentationLinger(false)
      if (streamBufferHoldTimerRef.current) {
        clearTimeout(streamBufferHoldTimerRef.current)
      }
      streamBufferHoldTimerRef.current = setTimeout(() => {
        streamBufferHoldTimerRef.current = null
        resetStreamingBuffers()
      }, STREAM_BUFFER_HOLD_AFTER_LINGER_MS)
      return
    }
    setIsStreamBridgeActive(true)
    streamBridgeReleaseTimerRef.current = setTimeout(() => {
      streamBridgeReleaseTimerRef.current = null
      releaseStreamBridge()
    }, 120)
  }, [
    streamBridgeReleaseTimerRef,
    streamBufferHoldTimerRef,
    userStoppedStreamRef,
    releaseStreamBridge,
    resetStreamingBuffers
  ])

  const handleToolCallStart = useCallback(
    (toolName: string, args?: unknown, toolCallId?: string) => {
      if (toolName === 'emoji_send') {
        let emojiId: string | null = null
        if (typeof args === 'object' && args !== null) {
          emojiId = String((args as Record<string, unknown>).emoji_id ?? '')
        } else if (typeof args === 'string') {
          try {
            const parsed = JSON.parse(args)
            if (parsed?.emoji_id) emojiId = String(parsed.emoji_id)
          } catch {
            if (args.length > 0) emojiId = args
          }
        }
        if (emojiId && emojiId.length > 0) {
          setPendingEmojis((prev) => [...prev, { emojiId }])
        }
        return
      }
      const callId =
        typeof toolCallId === 'string' && toolCallId
          ? toolCallId
          : `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const start = Date.now()
      const tool = { name: toolName, startTime: start, toolCallId: callId }
      activeToolRef.current = tool
      setActiveTool(tool)
      appendTimelineToolStart(timelineRef.current, {
        callId,
        name: toolName,
        args,
        startTime: start
      })
      flushTimelineNow()
    },
    [activeToolRef, setActiveTool, setPendingEmojis, timelineRef, flushTimelineNow]
  )

  const handleToolCallResult = useCallback(
    (toolName: string, result: unknown, toolCallId?: string) => {
      if (toolName === 'emoji_send') return
      const startTime = activeToolRef.current?.startTime ?? Date.now()
      const callId = toolCallId ?? activeToolRef.current?.toolCallId
      activeToolRef.current = null
      setActiveTool(null)
      setCompletedTools((prev) => [
        ...prev,
        { name: toolName, startTime, endTime: Date.now(), result, toolCallId: callId }
      ])
      completeTimelineTool(timelineRef.current, { callId, name: toolName, result })
      flushTimelineNow()
    },
    [activeToolRef, setActiveTool, setCompletedTools, timelineRef, flushTimelineNow]
  )

  /** 用户点停止：打断流，但留下已经打出来的半段，等落库后由 finishStream 交接 */
  const keepPartialOutputAfterUserStop = useCallback(() => {
    if (streamBridgeReleaseTimerRef.current) {
      clearTimeout(streamBridgeReleaseTimerRef.current)
      streamBridgeReleaseTimerRef.current = null
    }
    if (streamPresentationLingerTimerRef.current) {
      clearTimeout(streamPresentationLingerTimerRef.current)
      streamPresentationLingerTimerRef.current = null
    }
    if (streamBufferHoldTimerRef.current) {
      clearTimeout(streamBufferHoldTimerRef.current)
      streamBufferHoldTimerRef.current = null
    }
    streamAbortRef.current?.()
    streamAbortRef.current = null
    flushStreamingDisplayBuffers()
    stopAllAgentMarkdownRevealing()
    activeToolRef.current = null
    setActiveTool(null)
    isStreamingRef.current = false
    setIsStreaming(false)
    setIsCompressing(false)
    setLoading(false)
    setStreamPresentationLinger(false)
    if (hasStreamOutput()) {
      setIsStreamBridgeActive(true)
    } else {
      setIsStreamBridgeActive(false)
      resetStreamingBuffers()
    }
  }, [
    streamBridgeReleaseTimerRef,
    streamPresentationLingerTimerRef,
    streamBufferHoldTimerRef,
    streamAbortRef,
    flushStreamingDisplayBuffers,
    activeToolRef,
    setActiveTool,
    isStreamingRef,
    setIsStreaming,
    setIsCompressing,
    setLoading,
    hasStreamOutput,
    resetStreamingBuffers
  ])

  const interruptActiveStream = useCallback(
    (options?: { keepStreamingFlag?: boolean }) => {
      finishStreamPassRef.current += 1
      stopStreamingUiImmediately()
      if (options?.keepStreamingFlag) {
        isStreamingRef.current = true
        setIsStreaming(true)
      }
      resetStreamingBuffers()
      clearPendingEmojis()
    },
    [
      finishStreamPassRef,
      stopStreamingUiImmediately,
      isStreamingRef,
      setIsStreaming,
      resetStreamingBuffers,
      clearPendingEmojis
    ]
  )

  return useMemo(
    () => ({
      isStreamBridgeActive,
      streamPresentationLinger,
      hasStreamOutput,
      isActiveSession,
      clearStreamingDisplayBuffers,
      flushStreamingDisplayBuffers,
      appendStreamingTextDelta,
      appendStreamingReasoningDelta,
      resetCompressionDisplayBuffers,
      flushCompressionDisplayBuffers,
      appendCompressionTextDelta,
      appendCompressionReasoningDelta,
      resetCompressionBuffers,
      stopStreamingUiImmediately,
      resetStreamingBuffers,
      releaseStreamBridge,
      beginStreamBridgeHandoff,
      handleToolCallStart,
      handleToolCallResult,
      keepPartialOutputAfterUserStop,
      interruptActiveStream
    }),
    [
      isStreamBridgeActive,
      streamPresentationLinger,
      hasStreamOutput,
      isActiveSession,
      clearStreamingDisplayBuffers,
      flushStreamingDisplayBuffers,
      appendStreamingTextDelta,
      appendStreamingReasoningDelta,
      resetCompressionDisplayBuffers,
      flushCompressionDisplayBuffers,
      appendCompressionTextDelta,
      appendCompressionReasoningDelta,
      resetCompressionBuffers,
      stopStreamingUiImmediately,
      resetStreamingBuffers,
      releaseStreamBridge,
      beginStreamBridgeHandoff,
      handleToolCallStart,
      handleToolCallResult,
      keepPartialOutputAfterUserStop,
      interruptActiveStream
    ]
  )
}
