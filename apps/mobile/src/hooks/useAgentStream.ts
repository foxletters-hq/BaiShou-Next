import { useState, useRef, useCallback, useEffect } from 'react'
import {
  createStreamingTextDisplayBuffer,
  AgentGateReply,
  type StreamingTextDisplayBuffer
} from '@baishou/shared'
import { selectActivePendingForSession, useAgentGateInboxStore } from '@baishou/store'
import { useTranslation } from 'react-i18next'
import { useNativeToast } from '@baishou/ui/native'

import { useBaishou } from '../providers/BaishouProvider'
import { subscribeMobileCompressionEvents } from '../services/mobile-compression-event.service'
import { hydrateMobileAgentGateInbox } from '../services/mobile-agent-gate.service'
import { setMobileAgentGateFocusedSessionId } from '../services/mobile-agent-gate-notifications'
import { useAgentStreamBridge } from './useAgentStream-bridge'
import { useAgentStreamFinish } from './useAgentStream-finish'
import { useAgentStreamChat } from './useAgentStream-chat'
import { useAgentStreamActions } from './useAgentStream-actions'
import {
  EMPTY_TOKEN_USAGE,
  MOBILE_AGENT_STREAM_DISPLAY_OPTIONS,
  type AgentStreamRefs,
  type PendingEmoji,
  type RefreshSessionMessagesFn,
  type TokenUsage,
  type ToolCallInfo
} from './useAgentStream-types'

export type { PendingEmoji } from './useAgentStream-types'

export function useAgentStream(
  currentSessionId: string | null,
  currentProviderId: string | null,
  currentModelId: string | null,
  currentAssistant: { id?: string; name?: string } | null,
  onSessionCreated?: (sessionId: string) => void,
  onSessionListRefresh?: () => void,
  searchMode?: boolean,
  refreshSessionMessages?: RefreshSessionMessagesFn,
  bumpReloadEpoch?: () => void
) {
  const { services, vaultSwitching, agentGate } = useBaishou()
  const { t } = useTranslation()
  const toast = useNativeToast()
  const releaseRetryActionRef = useRef<() => void>(() => {})

  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [streamingReasoning, setStreamingReasoning] = useState('')
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>(EMPTY_TOKEN_USAGE)
  const [activeTool, setActiveTool] = useState<ToolCallInfo | null>(null)
  const [completedTools, setCompletedTools] = useState<ToolCallInfo[]>([])
  const [pendingEmojis, setPendingEmojis] = useState<PendingEmoji[]>([])
  const [streamError, setStreamError] = useState<string | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const [compressionPhase, setCompressionPhase] = useState<'auto' | 'manual'>('auto')
  const [compressionText, setCompressionText] = useState('')
  const [compressionReasoning, setCompressionReasoning] = useState('')
  const [compressionTriggerMessageId, setCompressionTriggerMessageId] = useState<string | null>(
    null
  )
  const pendingAgentGate = useAgentGateInboxStore((state) =>
    selectActivePendingForSession(state, currentSessionId)
  )
  const [isAgentGateReplying, setIsAgentGateReplying] = useState(false)

  const searchModeRef = useRef(searchMode)
  searchModeRef.current = searchMode
  const streamAbortRef = useRef<(() => void) | null>(null)
  const retryEpochRef = useRef(0)
  const activeToolRef = useRef<ToolCallInfo | null>(null)
  const currentSessionIdRef = useRef(currentSessionId)
  currentSessionIdRef.current = currentSessionId
  const streamingTextDisplayRef = useRef<StreamingTextDisplayBuffer | null>(null)
  const streamingReasoningDisplayRef = useRef<StreamingTextDisplayBuffer | null>(null)
  const compressionTextDisplayRef = useRef<StreamingTextDisplayBuffer | null>(null)
  const compressionReasoningDisplayRef = useRef<StreamingTextDisplayBuffer | null>(null)
  const streamFinalizeLockRef = useRef<string | null>(null)
  const finishStreamPassRef = useRef(0)
  const isStreamingRef = useRef(false)
  const isStreamBridgeActiveRef = useRef(false)
  const streamPresentationLingerRef = useRef(false)
  const reloadInFlightRef = useRef<Promise<boolean> | null>(null)
  const retryActionInFlightRef = useRef(false)
  const pendingRetryReleaseEpochRef = useRef<number | null>(null)
  const userStoppedStreamRef = useRef(false)
  const streamBridgeReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamPresentationLingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamBufferHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamAttemptErrorRef = useRef<string | null>(null)
  const completedToolsCountRef = useRef(0)
  const finishStreamInFlightRef = useRef<Promise<void> | null>(null)

  const refs: AgentStreamRefs = {
    searchModeRef,
    streamAbortRef,
    retryEpochRef,
    activeToolRef,
    currentSessionIdRef,
    streamingTextDisplayRef,
    streamingReasoningDisplayRef,
    compressionTextDisplayRef,
    compressionReasoningDisplayRef,
    streamFinalizeLockRef,
    finishStreamPassRef,
    isStreamingRef,
    isStreamBridgeActiveRef,
    streamPresentationLingerRef,
    reloadInFlightRef,
    retryActionInFlightRef,
    pendingRetryReleaseEpochRef,
    userStoppedStreamRef,
    streamBridgeReleaseTimerRef,
    streamPresentationLingerTimerRef,
    streamBufferHoldTimerRef,
    streamAttemptErrorRef,
    completedToolsCountRef,
    finishStreamInFlightRef
  }

  useEffect(() => {
    streamingTextDisplayRef.current = createStreamingTextDisplayBuffer(
      setStreamingText,
      MOBILE_AGENT_STREAM_DISPLAY_OPTIONS
    )
    streamingReasoningDisplayRef.current = createStreamingTextDisplayBuffer(
      setStreamingReasoning,
      MOBILE_AGENT_STREAM_DISPLAY_OPTIONS
    )
    compressionTextDisplayRef.current = createStreamingTextDisplayBuffer(
      (text) => setCompressionText(text),
      MOBILE_AGENT_STREAM_DISPLAY_OPTIONS
    )
    compressionReasoningDisplayRef.current = createStreamingTextDisplayBuffer(
      (text) => setCompressionReasoning(text),
      MOBILE_AGENT_STREAM_DISPLAY_OPTIONS
    )

    return () => {
      streamingTextDisplayRef.current?.reset()
      streamingReasoningDisplayRef.current?.reset()
      compressionTextDisplayRef.current?.reset()
      compressionReasoningDisplayRef.current?.reset()
    }
  }, [])

  useEffect(() => {
    isStreamingRef.current = isStreaming
  }, [isStreaming])

  useEffect(() => {
    completedToolsCountRef.current = completedTools.length
  }, [completedTools])

  const bridge = useAgentStreamBridge({
    refs,
    setIsStreaming,
    setIsCompressing,
    setCompressionText,
    setCompressionReasoning,
    setCompressionTriggerMessageId,
    setActiveTool,
    setCompletedTools,
    setPendingEmojis
  })

  const finish = useAgentStreamFinish({
    refs,
    refreshSessionMessages,
    setTokenUsage,
    setIsStreaming,
    isActiveSession: bridge.isActiveSession,
    flushStreamingDisplayBuffers: bridge.flushStreamingDisplayBuffers,
    beginStreamBridgeHandoff: bridge.beginStreamBridgeHandoff,
    releaseRetryAction: () => releaseRetryActionRef.current()
  })

  const chat = useAgentStreamChat({
    refs,
    currentSessionId,
    currentProviderId,
    currentModelId,
    currentAssistant,
    onSessionCreated,
    onSessionListRefresh,
    setIsStreaming,
    setStreamError,
    setIsCompressing,
    setCompressionText,
    setCompressionReasoning,
    setCompressionTriggerMessageId,
    appendStreamingTextDelta: bridge.appendStreamingTextDelta,
    appendStreamingReasoningDelta: bridge.appendStreamingReasoningDelta,
    handleToolCallStart: bridge.handleToolCallStart,
    handleToolCallResult: bridge.handleToolCallResult,
    hasStreamOutput: bridge.hasStreamOutput,
    interruptActiveStream: bridge.interruptActiveStream,
    resetStreamingBuffers: bridge.resetStreamingBuffers,
    resetCompressionBuffers: bridge.resetCompressionBuffers,
    finishStream: finish.finishStream,
    releaseRetryAction: () => releaseRetryActionRef.current()
  })

  const actions = useAgentStreamActions({
    refs,
    currentSessionId,
    currentProviderId,
    currentModelId,
    bumpReloadEpoch,
    setStreamError,
    setIsCompressing,
    setCompressionText,
    setCompressionReasoning,
    setCompressionTriggerMessageId,
    flushStreamingDisplayBuffers: bridge.flushStreamingDisplayBuffers,
    stopStreamingUiImmediately: bridge.stopStreamingUiImmediately,
    resetStreamingBuffers: bridge.resetStreamingBuffers,
    resetCompressionBuffers: bridge.resetCompressionBuffers,
    interruptActiveStream: bridge.interruptActiveStream,
    finishStream: finish.finishStream,
    reloadMessagesFromDb: finish.reloadMessagesFromDb,
    truncateSessionAndSyncUi: finish.truncateSessionAndSyncUi,
    streamFromExistingUserMessage: chat.streamFromExistingUserMessage
  })

  releaseRetryActionRef.current = actions.releaseRetryAction

  useEffect(() => {
    if (!currentSessionId) {
      setTokenUsage(EMPTY_TOKEN_USAGE)
      return
    }
    if (!isStreaming) {
      void finish.syncTokenUsageFromSession(currentSessionId)
    }
  }, [currentSessionId, isStreaming, finish])

  useEffect(() => {
    return subscribeMobileCompressionEvents((event) => {
      if (event.sessionId !== currentSessionIdRef.current) return

      if (event.type === 'start') {
        bridge.resetCompressionBuffers()
        setIsCompressing(true)
        setCompressionPhase(event.phase === 'manual' ? 'manual' : 'auto')
        setCompressionText('')
        setCompressionReasoning('')
        setCompressionTriggerMessageId(
          typeof event.triggerUserMessageId === 'string' ? event.triggerUserMessageId : null
        )
        return
      }

      if (event.type === 'reasoning-delta') {
        bridge.appendCompressionReasoningDelta(event.chunk ?? '')
        return
      }

      if (event.type === 'delta') {
        bridge.appendCompressionTextDelta(event.chunk ?? '')
        return
      }

      if (event.type === 'finish') {
        bridge.flushCompressionDisplayBuffers()
        setIsCompressing(false)
        if (!event.ok) {
          bridge.resetCompressionBuffers()
          setCompressionText('')
          setCompressionReasoning('')
          setCompressionTriggerMessageId(null)
          return
        }

        if (isStreamingRef.current) {
          bridge.resetCompressionBuffers()
          setCompressionText('')
          setCompressionReasoning('')
          setCompressionTriggerMessageId(null)
          return
        }

        void (async () => {
          const sessionId = event.sessionId
          try {
            await services?.sessionManager.flushSessionToDisk(sessionId)
          } catch {
            /* ignore */
          }
          await finish.reloadMessagesFromDb(sessionId, {
            preserveWindow: false,
            retryCount: 5,
            waitForLatestUsage: true
          })
          bridge.resetCompressionBuffers()
          setCompressionText('')
          setCompressionReasoning('')
          setCompressionTriggerMessageId(null)
        })()
      }
    })
  }, [bridge, finish, services])

  useEffect(() => {
    setMobileAgentGateFocusedSessionId(currentSessionId)
    void hydrateMobileAgentGateInbox()
    return () => {
      if (currentSessionIdRef.current === currentSessionId) {
        setMobileAgentGateFocusedSessionId(null)
      }
    }
  }, [currentSessionId])

  const replyAgentGate = useCallback(
    async (
      requestId: string,
      reply: AgentGateReply,
      extras?: { message?: string; selectedOptionIds?: string[] }
    ) => {
      if (!agentGate) {
        toast.showError(t('agent_gate.unavailable', '操作确认服务未就绪'))
        return
      }
      setIsAgentGateReplying(true)
      try {
        await agentGate.reply({ requestId, reply, ...extras })
        useAgentGateInboxStore.getState().removeReplied(requestId)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        toast.showError(msg || t('agent_gate.reply_failed', '确认操作失败'))
        throw e
      } finally {
        setIsAgentGateReplying(false)
      }
    },
    [agentGate, toast, t]
  )

  useEffect(() => {
    if (vaultSwitching) {
      bridge.interruptActiveStream()
    }
  }, [vaultSwitching, bridge])

  const updateTokenUsage = useCallback((usage: Partial<TokenUsage>) => {
    setTokenUsage((prev) => ({ ...prev, ...usage }))
  }, [])

  return {
    isStreaming,
    isStreamBridgeActive: bridge.isStreamBridgeActive,
    streamPresentationLinger: bridge.streamPresentationLinger,
    isRetryActionBusy: actions.isRetryActionBusy,
    isCompressing,
    compressionPhase,
    compressionText,
    compressionReasoning,
    compressionTriggerMessageId,
    streamError,
    streamingText,
    streamingReasoning,
    tokenUsage,
    activeTool,
    completedTools,
    pendingEmojis,
    pendingAgentGate,
    isAgentGateReplying,
    replyAgentGate,
    handleSend: chat.handleSend,
    handleStop: actions.handleStop,
    handleRegenerate: actions.handleRegenerate,
    handleResend: actions.handleResend,
    handleEditMessage: actions.handleEditMessage,
    handleSaveAssistantEdit: actions.handleSaveAssistantEdit,
    handleDeleteMessage: actions.handleDeleteMessage,
    updateTokenUsage
  }
}
