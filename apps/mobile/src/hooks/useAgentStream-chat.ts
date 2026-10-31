import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNativeToast } from '@baishou/ui/native'
import { useAgentStore } from '@baishou/store'
import {
  abortAgentStreamSession,
  claimAgentStreamSession,
  clearPendingAgentStreamStop,
  getSharedSessionInbox,
  isAgentStreamSessionBusy,
  releaseAgentStreamSession
} from '@baishou/ai'
import {
  isAgentStreamAbortError,
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  deriveSessionTitleFromUserText
} from '@baishou/shared'

import { useBaishou } from '../providers/BaishouProvider'
import { isTransientNetworkError } from '../utils/transient-network-error.util'
import { saveUserMessage } from '../services/mobile-agent-message.service'
import { runMobileAgentDbWrite } from '../services/mobile-agent-db-write.util'
import { buildInsertSessionInput } from '../utils/session-input.util'
import { resolveMobileActiveVaultId } from '../utils/mobile-session-vault.util'
import { mapSavedAttachmentsForMobileUi } from '../utils/mobile-attachment-ui.util'
import {
  STREAM_ZERO_OUTPUT_NETWORK_RETRIES,
  type AgentStreamOverrides,
  type AgentStreamRefs
} from './useAgentStream-types'

interface UseAgentStreamChatOptions {
  refs: AgentStreamRefs
  isStreaming: boolean
  currentSessionId: string | null
  currentProviderId: string | null
  currentModelId: string | null
  currentAssistant: { id?: string; name?: string } | null
  onSessionCreated?: (sessionId: string) => void
  onSessionListRefresh?: () => void
  setIsStreaming: (value: boolean) => void
  setStreamError: (value: string | null) => void
  setIsCompressing: (value: boolean) => void
  setCompressionText: (value: string) => void
  setCompressionReasoning: (value: string) => void
  setCompressionTriggerMessageId: (value: string | null) => void
  appendStreamingTextDelta: (chunk: string) => void
  appendStreamingReasoningDelta: (chunk: string) => void
  handleToolCallStart: (toolName: string, args?: unknown, toolCallId?: string) => void
  handleToolCallResult: (toolName: string, result: unknown, toolCallId?: string) => void
  hasStreamOutput: () => boolean
  interruptActiveStream: (options?: { keepStreamingFlag?: boolean }) => void
  resetStreamingBuffers: () => void
  resetCompressionBuffers: () => void
  finishStream: (
    sessionId: string,
    options?: { waitForLatestUsage?: boolean; releaseRetryEpoch?: number }
  ) => Promise<void>
  releaseRetryAction: () => void
}

export function useAgentStreamChat({
  refs,
  isStreaming,
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
  appendStreamingTextDelta,
  appendStreamingReasoningDelta,
  handleToolCallStart,
  handleToolCallResult,
  hasStreamOutput,
  interruptActiveStream,
  resetStreamingBuffers,
  resetCompressionBuffers,
  finishStream,
  releaseRetryAction
}: UseAgentStreamChatOptions) {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const { addMessage, setLoading } = useAgentStore()
  const { startAgentChat, services } = useBaishou()

  const {
    searchModeRef,
    streamAbortRef,
    streamAttemptErrorRef,
    userStoppedStreamRef,
    pendingRetryReleaseEpochRef,
    isStreamingRef
  } = refs

  const sendQueueLockRef = useRef<Promise<void>>(Promise.resolve())
  const drainingSessionsRef = useRef<Set<string>>(new Set())
  const drainAgainSessionsRef = useRef<Set<string>>(new Set())
  const drainAfterSteerAbortRef = useRef<Set<string>>(new Set())
  const idleDrainWatchersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const drainMobileSessionInboxRef = useRef<(sessionId: string) => Promise<void>>(async () => {})

  const scheduleMobileDrainWhenIdle = useCallback(
    (sessionId: string) => {
      if (!sessionId) return
      const existingTimer = idleDrainWatchersRef.current.get(sessionId)
      if (existingTimer) {
        clearTimeout(existingTimer)
        idleDrainWatchersRef.current.delete(sessionId)
      }

      const deadline = Date.now() + 5000
      const step = () => {
        idleDrainWatchersRef.current.delete(sessionId)
        if (getSharedSessionInbox().listPending(sessionId).length === 0) return
        if (userStoppedStreamRef.current && !drainAfterSteerAbortRef.current.has(sessionId)) return
        if (!isAgentStreamSessionBusy(sessionId) && !drainingSessionsRef.current.has(sessionId)) {
          void drainMobileSessionInboxRef.current(sessionId)
          return
        }
        if (Date.now() < deadline) {
          idleDrainWatchersRef.current.set(sessionId, setTimeout(step, 25))
        }
      }
      idleDrainWatchersRef.current.set(sessionId, setTimeout(step, 0))
    },
    [userStoppedStreamRef]
  )

  useEffect(() => {
    const watchers = idleDrainWatchersRef.current
    return () => {
      for (const timer of watchers.values()) clearTimeout(timer)
      watchers.clear()
    }
  }, [])

  const invokeAgentStreamChat = useCallback(
    async (
      sessionId: string,
      userText: string,
      overrides: AgentStreamOverrides,
      onFail: (errorMsg: string) => void,
      onClaimReplaced?: (claim: ReturnType<typeof claimAgentStreamSession>) => void
    ) => {
      if (!startAgentChat) return

      let activeOverrides = overrides

      for (let attempt = 0; attempt <= STREAM_ZERO_OUTPUT_NETWORK_RETRIES; attempt++) {
        streamAttemptErrorRef.current = null

        if (attempt > 0) {
          if (userStoppedStreamRef.current) return
          setStreamError(null)
          interruptActiveStream({ keepStreamingFlag: true })
          resetStreamingBuffers()
          const claim = claimAgentStreamSession(sessionId)
          streamAbortRef.current = claim.abort
          onClaimReplaced?.(claim)
          activeOverrides = {
            ...activeOverrides,
            abortSignal: claim.signal,
            streamClaimGeneration: claim.generation
          }
        }

        let thrownError: unknown = null
        try {
          await startAgentChat(
            sessionId,
            userText,
            {
              onTextDelta: (chunk) => {
                if (!userStoppedStreamRef.current) appendStreamingTextDelta(chunk)
              },
              onReasoningDelta: (chunk) => {
                if (!userStoppedStreamRef.current) appendStreamingReasoningDelta(chunk)
              },
              onToolCallStart: (toolName, args, toolCallId) => {
                if (!userStoppedStreamRef.current) handleToolCallStart(toolName, args, toolCallId)
              },
              onToolCallResult: (toolName, result, toolCallId) => {
                if (!userStoppedStreamRef.current)
                  handleToolCallResult(toolName, result, toolCallId)
              },
              onFinish: () => {},
              onError: (err) => {
                if (userStoppedStreamRef.current || isAgentStreamAbortError(err)) return
                const msg = err.message || t('app.unknown_error', '未知网络或系统错误')
                streamAttemptErrorRef.current = msg
                onFail(msg)
              }
            },
            activeOverrides
          )
        } catch (e) {
          thrownError = e
          if (userStoppedStreamRef.current || isAgentStreamAbortError(e)) return
          const msg = e instanceof Error ? e.message : String(e)
          streamAttemptErrorRef.current = msg
          onFail(msg)
        }

        const retryableError = thrownError ?? streamAttemptErrorRef.current
        if (!retryableError) break
        if (hasStreamOutput()) break
        if (attempt >= STREAM_ZERO_OUTPUT_NETWORK_RETRIES) break
        if (!isTransientNetworkError(retryableError)) break
      }
    },
    [
      startAgentChat,
      t,
      interruptActiveStream,
      resetStreamingBuffers,
      hasStreamOutput,
      appendStreamingTextDelta,
      appendStreamingReasoningDelta,
      handleToolCallStart,
      handleToolCallResult,
      streamAttemptErrorRef,
      userStoppedStreamRef,
      streamAbortRef,
      setStreamError
    ]
  )

  const streamFromExistingUserMessage = useCallback(
    async (
      sessionId: string,
      userMessage: { id: string; content: string; attachments?: unknown[] },
      options?: { retryReleaseEpoch?: number }
    ) => {
      if (
        !isConfiguredProviderId(currentProviderId) ||
        !isConfiguredDialogueModelId(currentModelId)
      ) {
        toast.showInfo(t('agent.error.no_model', '请先在输入栏选择一个模型'))
        if (options?.retryReleaseEpoch !== undefined) {
          releaseRetryAction()
        }
        return
      }

      const releaseEpoch = options?.retryReleaseEpoch ?? null
      if (releaseEpoch !== null) {
        pendingRetryReleaseEpochRef.current = releaseEpoch
      }

      const fail = (errorMsg: string) => {
        if (!userStoppedStreamRef.current) setStreamError(errorMsg)
      }

      userStoppedStreamRef.current = false
      clearPendingAgentStreamStop(sessionId)
      interruptActiveStream()
      let claim = claimAgentStreamSession(sessionId)
      streamAbortRef.current = claim.abort
      isStreamingRef.current = true
      setLoading(true)
      setIsStreaming(true)
      setStreamError(null)
      resetStreamingBuffers()
      resetCompressionBuffers()
      setIsCompressing(false)
      setCompressionText('')
      setCompressionReasoning('')
      setCompressionTriggerMessageId(null)

      let stoppedByUser = false
      try {
        await invokeAgentStreamChat(
          sessionId,
          userMessage.content,
          {
            providerId: currentProviderId || undefined,
            modelId: currentModelId || undefined,
            searchMode: searchModeRef.current,
            abortSignal: claim.signal,
            userMessageId: userMessage.id,
            skipUserMessageRecording: true,
            forceRecompress: true,
            streamClaimGeneration: claim.generation,
            attachments: userMessage.attachments
          },
          fail,
          (nextClaim) => {
            claim = nextClaim
          }
        )
        stoppedByUser = userStoppedStreamRef.current
        if (stoppedByUser) setStreamError(null)
        await finishStream(sessionId, {
          waitForLatestUsage: !stoppedByUser && !streamAttemptErrorRef.current,
          releaseRetryEpoch: releaseEpoch ?? undefined
        })
      } catch (e) {
        stoppedByUser = userStoppedStreamRef.current
        if (stoppedByUser) setStreamError(null)
        else fail(e instanceof Error ? e.message : String(e))
        await finishStream(sessionId, {
          waitForLatestUsage: false,
          releaseRetryEpoch: releaseEpoch ?? undefined
        })
      } finally {
        releaseAgentStreamSession(sessionId, claim.generation)
        const steered = drainAfterSteerAbortRef.current.delete(sessionId)
        userStoppedStreamRef.current = false
        if (
          (!stoppedByUser || steered) &&
          (drainAgainSessionsRef.current.delete(sessionId) ||
            getSharedSessionInbox().listPending(sessionId).length > 0)
        ) {
          scheduleMobileDrainWhenIdle(sessionId)
        }
      }
    },
    [
      currentProviderId,
      currentModelId,
      toast,
      t,
      finishStream,
      interruptActiveStream,
      releaseRetryAction,
      resetStreamingBuffers,
      resetCompressionBuffers,
      setLoading,
      setIsStreaming,
      setStreamError,
      setIsCompressing,
      setCompressionText,
      setCompressionReasoning,
      setCompressionTriggerMessageId,
      invokeAgentStreamChat,
      scheduleMobileDrainWhenIdle,
      searchModeRef,
      streamAbortRef,
      streamAttemptErrorRef,
      userStoppedStreamRef,
      pendingRetryReleaseEpochRef,
      isStreamingRef
    ]
  )

  const runSessionStreamTurn = useCallback(
    async (
      sessionId: string,
      text: string,
      userMessageId: string,
      overrides?: {
        providerId?: string
        modelId?: string
        searchMode?: boolean
        attachments?: unknown[]
      }
    ): Promise<'ok' | 'stopped'> => {
      userStoppedStreamRef.current = false
      clearPendingAgentStreamStop(sessionId)
      interruptActiveStream({ keepStreamingFlag: true })
      let claim = claimAgentStreamSession(sessionId)
      streamAbortRef.current = claim.abort
      isStreamingRef.current = true

      setLoading(true)
      setIsStreaming(true)
      setStreamError(null)
      resetStreamingBuffers()

      const failStream = (errorMsg: string) => {
        if (!userStoppedStreamRef.current) setStreamError(errorMsg)
      }

      let stoppedByUser = false
      try {
        await invokeAgentStreamChat(
          sessionId,
          text,
          {
            providerId: overrides?.providerId,
            modelId: overrides?.modelId,
            searchMode: overrides?.searchMode,
            abortSignal: claim.signal,
            userMessageId,
            skipUserMessageRecording: true,
            streamClaimGeneration: claim.generation,
            attachments: overrides?.attachments
          },
          failStream,
          (nextClaim) => {
            claim = nextClaim
          }
        )
        stoppedByUser = userStoppedStreamRef.current
        if (stoppedByUser) setStreamError(null)
        await finishStream(sessionId, {
          waitForLatestUsage: !stoppedByUser && !streamAttemptErrorRef.current
        })
      } catch (e: unknown) {
        stoppedByUser = userStoppedStreamRef.current
        if (stoppedByUser) setStreamError(null)
        else failStream(e instanceof Error ? e.message : String(e))
        await finishStream(sessionId, { waitForLatestUsage: false })
      } finally {
        releaseAgentStreamSession(sessionId, claim.generation)
      }

      const steered = drainAfterSteerAbortRef.current.delete(sessionId)
      userStoppedStreamRef.current = false
      return stoppedByUser && !steered ? 'stopped' : 'ok'
    },
    [
      userStoppedStreamRef,
      interruptActiveStream,
      streamAbortRef,
      streamAttemptErrorRef,
      isStreamingRef,
      setLoading,
      setIsStreaming,
      setStreamError,
      resetStreamingBuffers,
      invokeAgentStreamChat,
      finishStream
    ]
  )

  const drainMobileSessionInbox = useCallback(
    async (sessionId: string) => {
      if (drainingSessionsRef.current.has(sessionId)) {
        drainAgainSessionsRef.current.add(sessionId)
        return
      }
      if (isAgentStreamSessionBusy(sessionId)) {
        drainAgainSessionsRef.current.add(sessionId)
        scheduleMobileDrainWhenIdle(sessionId)
        return
      }
      drainingSessionsRef.current.add(sessionId)

      let stoppedByUser = false
      try {
        for (;;) {
          if (userStoppedStreamRef.current && !drainAfterSteerAbortRef.current.has(sessionId)) {
            stoppedByUser = true
            break
          }
          if (isAgentStreamSessionBusy(sessionId)) {
            drainAgainSessionsRef.current.add(sessionId)
            break
          }
          const inbox = getSharedSessionInbox()
          const promoted = inbox.promoteNext(sessionId)
          if (!promoted) break

          const payload = (promoted.payload ?? {}) as {
            providerId?: string
            modelId?: string
            searchMode?: boolean
            attachments?: unknown[]
          }

          const outcome = await runSessionStreamTurn(
            sessionId,
            promoted.text,
            promoted.userMessageId ?? '',
            payload
          )

          if (outcome === 'stopped') {
            stoppedByUser = true
            break
          }
        }
      } finally {
        drainingSessionsRef.current.delete(sessionId)
        const shouldDrainAgain =
          drainAgainSessionsRef.current.delete(sessionId) ||
          getSharedSessionInbox().listPending(sessionId).length > 0
        if (shouldDrainAgain && !stoppedByUser) {
          if (!isAgentStreamSessionBusy(sessionId)) {
            void drainMobileSessionInbox(sessionId)
          } else {
            scheduleMobileDrainWhenIdle(sessionId)
          }
        }
      }
    },
    [runSessionStreamTurn, scheduleMobileDrainWhenIdle, userStoppedStreamRef]
  )
  drainMobileSessionInboxRef.current = drainMobileSessionInbox

  useEffect(() => {
    if (!currentSessionId || isStreaming) return
    if (userStoppedStreamRef.current && !drainAfterSteerAbortRef.current.has(currentSessionId)) {
      return
    }
    if (getSharedSessionInbox().listPending(currentSessionId).length === 0) return
    scheduleMobileDrainWhenIdle(currentSessionId)
  }, [currentSessionId, isStreaming, scheduleMobileDrainWhenIdle, userStoppedStreamRef])

  const handleSend = useCallback(
    async (
      text: string,
      attachments?: unknown[],
      sendSearchMode?: boolean,
      meta?: {
        displayText?: string
        skillRefs?: Array<{ command: string; content: string }>
        fileRefs?: unknown[]
      }
    ): Promise<boolean> => {
      const hasText = Boolean(text.trim())
      const hasAttachments = Boolean(attachments?.length)
      const hasCites = Boolean(meta?.skillRefs?.length || meta?.fileRefs?.length)
      if ((!hasText && !hasAttachments && !hasCites) || !services) return false

      if (
        !isConfiguredProviderId(currentProviderId) ||
        !isConfiguredDialogueModelId(currentModelId)
      ) {
        toast.showInfo(t('agent.error.no_model', '请先在输入栏选择一个模型'))
        return false
      }

      let unlock: () => void = () => {}
      const prevLock = sendQueueLockRef.current
      sendQueueLockRef.current = new Promise<void>((resolve) => {
        unlock = resolve
      })

      try {
        await prevLock

        const effectiveSearchMode = sendSearchMode ?? searchModeRef.current ?? false
        let sessionId = currentSessionId
        const wasNewSession = !sessionId

        if (!sessionId) {
          try {
            const newSessionId = Date.now().toString()
            const firstAtt = attachments?.[0] as { fileName?: string; name?: string } | undefined
            const sessionTitleSource =
              text.trim() ||
              firstAtt?.fileName ||
              firstAtt?.name ||
              t('agent.sessions.default_title', '新对话')
            const vaultId = resolveMobileActiveVaultId(services)
            await runMobileAgentDbWrite('upsertSession', async (runtime) => {
              await runtime.sessionManager.upsertSession(
                buildInsertSessionInput(
                  {
                    id: newSessionId,
                    title:
                      deriveSessionTitleFromUserText(sessionTitleSource) ||
                      t('agent.sessions.default_title', '新对话'),
                    assistantId: currentAssistant?.id,
                    providerId: currentProviderId || undefined,
                    modelId: currentModelId || undefined
                  },
                  vaultId
                )
              )
            })
            sessionId = newSessionId
          } catch (e) {
            console.error('Failed to create session', e)
            toast.showError(
              t('agent.error.create_session', '由于系统原因创建会话失败: {{msg}}', { msg: '' })
            )
            setLoading(false)
            setIsStreaming(false)
            return false
          }
        }

        const saveResult = await saveUserMessage(
          services.sessionRepo,
          services.sessionManager,
          services.pathService,
          services.fileSystem,
          {
            sessionId,
            text,
            attachments,
            modelId: currentModelId || undefined,
            providerType: currentProviderId || undefined,
            displayText: meta?.displayText,
            skillRefs: meta?.skillRefs,
            fileRefs: meta?.fileRefs
          }
        )
        if ('error' in saveResult) {
          toast.showError(saveResult.error)
          setLoading(false)
          setIsStreaming(false)
          return false
        }

        if (wasNewSession) {
          onSessionCreated?.(sessionId)
          onSessionListRefresh?.()
        }

        addMessage({
          id: saveResult.userMessageId,
          role: 'user',
          content: meta?.displayText || text,
          timestamp: new Date(),
          skillRefs: meta?.skillRefs,
          fileRefs: meta?.fileRefs,
          attachments: mapSavedAttachmentsForMobileUi(
            saveResult.attachments,
            await services.pathService.getRootDirectory(),
            await services.pathService.getAttachmentsBaseDirectory()
          ) as any
        })

        const isBusy =
          refs.isStreamingRef.current ||
          isAgentStreamSessionBusy(sessionId) ||
          drainingSessionsRef.current.has(sessionId)

        getSharedSessionInbox().admit({
          sessionId,
          text,
          delivery: 'queue',
          userMessageId: saveResult.userMessageId,
          payload: {
            providerId: currentProviderId || undefined,
            modelId: currentModelId || undefined,
            searchMode: effectiveSearchMode,
            attachments: saveResult.attachments
          }
        })

        if (!isBusy) {
          userStoppedStreamRef.current = false
          void drainMobileSessionInbox(sessionId)
        } else {
          drainAgainSessionsRef.current.add(sessionId)
          scheduleMobileDrainWhenIdle(sessionId)
        }

        return true
      } finally {
        unlock()
      }
    },
    [
      services,
      currentProviderId,
      currentModelId,
      currentSessionId,
      toast,
      t,
      searchModeRef,
      currentAssistant,
      onSessionCreated,
      onSessionListRefresh,
      addMessage,
      refs.isStreamingRef,
      userStoppedStreamRef,
      drainMobileSessionInbox,
      scheduleMobileDrainWhenIdle,
      setLoading,
      setIsStreaming
    ]
  )

  const steerPendingInput = useCallback(
    async (sessionId: string, inputId: string) => {
      const updated = getSharedSessionInbox().setPendingDelivery(inputId, 'steer')
      if (!updated) return
      userStoppedStreamRef.current = false
      if (isStreamingRef.current || isAgentStreamSessionBusy(sessionId)) {
        drainAfterSteerAbortRef.current.add(sessionId)
        drainAgainSessionsRef.current.add(sessionId)
        streamAbortRef.current?.()
        abortAgentStreamSession(sessionId)
        scheduleMobileDrainWhenIdle(sessionId)
        return
      }
      await drainMobileSessionInbox(sessionId)
    },
    [
      drainMobileSessionInbox,
      isStreamingRef,
      scheduleMobileDrainWhenIdle,
      streamAbortRef,
      userStoppedStreamRef
    ]
  )

  return {
    invokeAgentStreamChat,
    streamFromExistingUserMessage,
    handleSend,
    steerPendingInput
  }
}
