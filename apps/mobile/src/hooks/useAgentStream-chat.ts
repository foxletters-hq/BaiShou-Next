import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNativeToast } from '@baishou/ui/native'
import { useAgentStore } from '@baishou/store'
import { claimAgentStreamSession } from '@baishou/ai'
import {
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  deriveSessionTitleFromUserText,
  isAgentStreamAbortError
} from '@baishou/shared'

import { useBaishou } from '../providers/BaishouProvider'
import { isTransientNetworkError } from '../utils/transient-network-error.util'
import { saveUserMessage } from '../services/mobile-agent-message.service'
import { runMobileAgentDbWrite } from '../services/mobile-agent-db-write.util'
import { buildInsertSessionInput } from '../utils/session-input.util'
import { mapSavedAttachmentsForMobileUi } from '../utils/mobile-attachment-ui.util'
import {
  STREAM_ZERO_OUTPUT_NETWORK_RETRIES,
  type AgentStreamOverrides,
  type AgentStreamRefs
} from './useAgentStream-types'

interface UseAgentStreamChatOptions {
  refs: AgentStreamRefs
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
  handleToolCallStart: (toolName: string, args?: unknown) => void
  handleToolCallResult: (toolName: string, result: unknown) => void
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
    pendingRetryReleaseEpochRef
  } = refs

  const invokeAgentStreamChat = useCallback(
    async (
      sessionId: string,
      userText: string,
      overrides: AgentStreamOverrides,
      onFail: (errorMsg: string) => void
    ) => {
      if (!startAgentChat) return

      let activeOverrides = overrides

      for (let attempt = 0; attempt <= STREAM_ZERO_OUTPUT_NETWORK_RETRIES; attempt++) {
        streamAttemptErrorRef.current = null

        if (attempt > 0) {
          userStoppedStreamRef.current = false
          setStreamError(null)
          interruptActiveStream({ keepStreamingFlag: true })
          resetStreamingBuffers()
          const claim = claimAgentStreamSession(sessionId)
          streamAbortRef.current = claim.abort
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
              onTextDelta: appendStreamingTextDelta,
              onReasoningDelta: appendStreamingReasoningDelta,
              onToolCallStart: handleToolCallStart,
              onToolCallResult: handleToolCallResult,
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
        toast.showInfo(t('agent.error.no_model', '请先在顶部选择一个模型'))
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
        if (userStoppedStreamRef.current || isAgentStreamAbortError(errorMsg)) return
        setStreamError(errorMsg)
      }

      userStoppedStreamRef.current = false
      interruptActiveStream()
      const claim = claimAgentStreamSession(sessionId)
      streamAbortRef.current = claim.abort
      setLoading(true)
      setIsStreaming(true)
      setStreamError(null)
      resetStreamingBuffers()
      resetCompressionBuffers()
      setIsCompressing(false)
      setCompressionText('')
      setCompressionReasoning('')
      setCompressionTriggerMessageId(null)

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
          fail
        )
        await finishStream(sessionId, {
          waitForLatestUsage: true,
          releaseRetryEpoch: releaseEpoch ?? undefined
        })
      } catch (e) {
        if (userStoppedStreamRef.current || isAgentStreamAbortError(e)) {
          userStoppedStreamRef.current = false
          setStreamError(null)
        } else {
          const msg = e instanceof Error ? e.message : String(e)
          fail(msg)
        }
        await finishStream(sessionId, {
          waitForLatestUsage: true,
          releaseRetryEpoch: releaseEpoch ?? undefined
        })
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
      searchModeRef,
      streamAbortRef,
      userStoppedStreamRef,
      pendingRetryReleaseEpochRef
    ]
  )

  const handleSend = useCallback(
    async (text: string, attachments?: unknown[], sendSearchMode?: boolean): Promise<boolean> => {
      const hasText = Boolean(text.trim())
      const hasAttachments = Boolean(attachments?.length)
      if ((!hasText && !hasAttachments) || !services) return false

      if (
        !isConfiguredProviderId(currentProviderId) ||
        !isConfiguredDialogueModelId(currentModelId)
      ) {
        toast.showInfo(t('agent.error.no_model', '请先在顶部选择一个模型'))
        return false
      }

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
          const vaultName = await services.pathService
            .getActiveVaultNameForContext()
            .catch(() => 'Personal')
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
                vaultName
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
          providerType: currentProviderId || undefined
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

      userStoppedStreamRef.current = false
      interruptActiveStream({ keepStreamingFlag: true })
      const claim = claimAgentStreamSession(sessionId)
      streamAbortRef.current = claim.abort

      addMessage({
        id: saveResult.userMessageId,
        role: 'user',
        content: text,
        timestamp: new Date(),
        attachments: mapSavedAttachmentsForMobileUi(
          saveResult.attachments,
          await services.pathService.getRootDirectory(),
          await services.pathService.getAttachmentsBaseDirectory()
        ) as any
      })

      setLoading(true)
      setIsStreaming(true)
      setStreamError(null)
      resetStreamingBuffers()

      const failStream = (errorMsg: string) => {
        if (userStoppedStreamRef.current || isAgentStreamAbortError(errorMsg)) return
        setStreamError(errorMsg)
      }

      // 对齐桌面：流式 fire-and-forget，避免 InputBar isSending 绑住整段生成导致发送键无法变色
      const streamSessionId = sessionId!
      void (async () => {
        try {
          await invokeAgentStreamChat(
            streamSessionId,
            text,
            {
              providerId: currentProviderId || undefined,
              modelId: currentModelId || undefined,
              searchMode: effectiveSearchMode,
              abortSignal: claim.signal,
              userMessageId: saveResult.userMessageId,
              skipUserMessageRecording: true,
              streamClaimGeneration: claim.generation,
              attachments: saveResult.attachments
            },
            failStream
          )
          await finishStream(streamSessionId, { waitForLatestUsage: true })
        } catch (e: unknown) {
          if (userStoppedStreamRef.current || isAgentStreamAbortError(e)) {
            userStoppedStreamRef.current = false
            setStreamError(null)
          } else {
            const msg = e instanceof Error ? e.message : String(e)
            failStream(msg)
          }
          await finishStream(streamSessionId, { waitForLatestUsage: true })
        }
      })()

      return true
    },
    [
      currentSessionId,
      currentAssistant,
      currentProviderId,
      currentModelId,
      services,
      t,
      addMessage,
      setLoading,
      onSessionCreated,
      onSessionListRefresh,
      finishStream,
      resetStreamingBuffers,
      interruptActiveStream,
      invokeAgentStreamChat,
      toast,
      searchModeRef,
      streamAbortRef,
      userStoppedStreamRef,
      setIsStreaming,
      setStreamError
    ]
  )

  return {
    invokeAgentStreamChat,
    streamFromExistingUserMessage,
    handleSend
  }
}
