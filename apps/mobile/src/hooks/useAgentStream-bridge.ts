import { useState, useCallback, useEffect, type Dispatch, type SetStateAction } from 'react'
import { useAgentStore } from '@baishou/store'

import {
  STREAM_BUFFER_HOLD_AFTER_LINGER_MS,
  STREAM_PRESENTATION_LINGER_MS,
  type AgentStreamRefs,
  type ToolCallInfo
} from './useAgentStream-types'

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
  setPendingEmojis
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
    finishStreamPassRef,
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
      completedToolsCountRef.current > 0
    )
  }, [streamingTextDisplayRef, streamingReasoningDisplayRef, activeToolRef, completedToolsCountRef])

  const isActiveSession = useCallback(
    (sessionId: string) => currentSessionIdRef.current === sessionId,
    [currentSessionIdRef]
  )

  const clearStreamingDisplayBuffers = useCallback(() => {
    streamingTextDisplayRef.current?.reset()
    streamingReasoningDisplayRef.current?.reset()
  }, [streamingTextDisplayRef, streamingReasoningDisplayRef])

  const flushStreamingDisplayBuffers = useCallback(() => {
    streamingTextDisplayRef.current?.flush()
    streamingReasoningDisplayRef.current?.flush()
  }, [streamingTextDisplayRef, streamingReasoningDisplayRef])

  const appendStreamingTextDelta = useCallback(
    (chunk: string) => {
      streamingTextDisplayRef.current?.push(chunk)
    },
    [streamingTextDisplayRef]
  )

  const appendStreamingReasoningDelta = useCallback(
    (chunk: string) => {
      streamingReasoningDisplayRef.current?.push(chunk)
    },
    [streamingReasoningDisplayRef]
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
    streamAbortRef.current?.()
    streamAbortRef.current = null
    isStreamingRef.current = false
    setIsStreaming(false)
    setIsStreamBridgeActive(false)
    setIsCompressing(false)
    setLoading(false)
    activeToolRef.current = null
    setActiveTool(null)
    setCompletedTools([])
    resetCompressionBuffers()
    setCompressionText('')
    setCompressionReasoning('')
    setCompressionTriggerMessageId(null)
    clearStreamingDisplayBuffers()
    activeToolRef.current = null
    setActiveTool(null)
    setCompletedTools([])
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
    setCompletedTools,
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
    setCompletedTools([])
    setPendingEmojis([])
  }, [
    clearStreamingDisplayBuffers,
    activeToolRef,
    setActiveTool,
    setCompletedTools,
    setPendingEmojis
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
    streamPresentationLingerTimerRef.current = setTimeout(() => {
      streamPresentationLingerTimerRef.current = null
      setStreamPresentationLinger(false)
    }, STREAM_PRESENTATION_LINGER_MS)
    streamBufferHoldTimerRef.current = setTimeout(() => {
      streamBufferHoldTimerRef.current = null
      resetStreamingBuffers()
    }, STREAM_PRESENTATION_LINGER_MS + STREAM_BUFFER_HOLD_AFTER_LINGER_MS)
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
    setIsStreamBridgeActive(true)
    streamBridgeReleaseTimerRef.current = setTimeout(() => {
      streamBridgeReleaseTimerRef.current = null
      releaseStreamBridge()
    }, 300)
  }, [streamBridgeReleaseTimerRef, releaseStreamBridge])

  const handleToolCallStart = useCallback(
    (toolName: string, args?: unknown) => {
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
      const tool = { name: toolName, startTime: Date.now() }
      activeToolRef.current = tool
      setActiveTool(tool)
    },
    [activeToolRef, setActiveTool, setPendingEmojis]
  )

  const handleToolCallResult = useCallback(
    (toolName: string, result: unknown) => {
      if (toolName === 'emoji_send') return
      const startTime = activeToolRef.current?.startTime ?? Date.now()
      activeToolRef.current = null
      setActiveTool(null)
      setCompletedTools((prev) => [
        ...prev,
        { name: toolName, startTime, endTime: Date.now(), result }
      ])
    },
    [activeToolRef, setActiveTool, setCompletedTools]
  )

  const interruptActiveStream = useCallback(
    (options?: { keepStreamingFlag?: boolean }) => {
      finishStreamPassRef.current += 1
      stopStreamingUiImmediately()
      if (options?.keepStreamingFlag) {
        isStreamingRef.current = true
        setIsStreaming(true)
      }
      resetStreamingBuffers()
      setPendingEmojis([])
    },
    [
      finishStreamPassRef,
      stopStreamingUiImmediately,
      isStreamingRef,
      setIsStreaming,
      resetStreamingBuffers,
      setPendingEmojis
    ]
  )

  return {
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
    interruptActiveStream
  }
}
