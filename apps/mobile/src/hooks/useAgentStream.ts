import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNativeToast, useDialog } from '@baishou/ui/native'
import { useAgentStore } from '@baishou/store'
import {
  reconcileCompressionStateAfterTruncate,
  truncateSessionAfterOrderIndex,
  truncateOptionsWithDiskFlush,
  claimAgentStreamSession
} from '@baishou/ai'
import {
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  deriveSessionTitleFromUserText,
  createStreamingTextDisplayBuffer,
  isAgentStreamAbortError,
  type StreamingTextDisplayBuffer
} from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'
import { saveUserMessage } from '../services/mobile-agent-message.service'
import { runMobileAgentDbWrite } from '../services/mobile-agent-db-write.util'
import { buildInsertSessionInput } from '../utils/session-input.util'
import { mapSessionMessageFromDb } from '../utils/map-session-message.util'
import { mapSavedAttachmentsForMobileUi } from '../utils/mobile-attachment-ui.util'
import { subscribeMobileCompressionEvents } from '../services/mobile-compression-event.service'

const MOBILE_AGENT_STREAM_DISPLAY_OPTIONS = {
  immediate: true
} as const

interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheWriteInputTokens: number
  totalCostMicros: number
}

interface ToolCallInfo {
  name: string
  startTime: number
  endTime?: number
  result?: unknown
}

export function useAgentStream(
  currentSessionId: string | null,
  currentProviderId: string | null,
  currentModelId: string | null,
  currentAssistant: { id?: string; name?: string } | null,
  onSessionCreated?: (sessionId: string) => void,
  onSessionListRefresh?: () => void,
  searchMode?: boolean,
  refreshSessionMessages?: (
    sessionId: string,
    options?: {
      preserveWindow?: boolean
      retryCount?: number
      waitForLatestUsage?: boolean
      commitToUi?: boolean
    }
  ) => Promise<boolean>,
  bumpReloadEpoch?: () => void
) {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { addMessage, updateMessage, setLoading, clearSession, messages } = useAgentStore()
  const { startAgentChat, services, vaultSwitching } = useBaishou()

  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [streamingReasoning, setStreamingReasoning] = useState('')
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheWriteInputTokens: 0,
    totalCostMicros: 0
  })
  const [activeTool, setActiveTool] = useState<ToolCallInfo | null>(null)
  const [completedTools, setCompletedTools] = useState<ToolCallInfo[]>([])
  const [streamError, setStreamError] = useState<string | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const [compressionPhase, setCompressionPhase] = useState<'auto' | 'manual'>('auto')
  const [compressionText, setCompressionText] = useState('')
  const [compressionReasoning, setCompressionReasoning] = useState('')
  const [compressionTriggerMessageId, setCompressionTriggerMessageId] = useState<string | null>(
    null
  )

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

  const streamFinalizeLockRef = useRef<string | null>(null)
  const finishStreamPassRef = useRef(0)
  const isStreamingRef = useRef(false)
  const reloadInFlightRef = useRef<Promise<boolean> | null>(null)
  const retryActionInFlightRef = useRef(false)
  const pendingRetryReleaseEpochRef = useRef<number | null>(null)
  const userStoppedStreamRef = useRef(false)

  const [isStreamBridgeActive, setIsStreamBridgeActive] = useState(false)
  const [isRetryActionBusy, setIsRetryActionBusy] = useState(false)

  useEffect(() => {
    isStreamingRef.current = isStreaming
  }, [isStreaming])

  const isActiveSession = useCallback(
    (sessionId: string) => currentSessionIdRef.current === sessionId,
    []
  )

  const clearStreamingDisplayBuffers = useCallback(() => {
    streamingTextDisplayRef.current?.reset()
    streamingReasoningDisplayRef.current?.reset()
  }, [])

  const flushStreamingDisplayBuffers = useCallback(() => {
    streamingTextDisplayRef.current?.flush()
    streamingReasoningDisplayRef.current?.flush()
  }, [])

  const appendStreamingTextDelta = useCallback((chunk: string) => {
    streamingTextDisplayRef.current?.push(chunk)
  }, [])

  const appendStreamingReasoningDelta = useCallback((chunk: string) => {
    streamingReasoningDisplayRef.current?.push(chunk)
  }, [])

  const resetCompressionDisplayBuffers = useCallback(() => {
    compressionTextDisplayRef.current?.reset()
    compressionReasoningDisplayRef.current?.reset()
  }, [])

  const flushCompressionDisplayBuffers = useCallback(() => {
    compressionTextDisplayRef.current?.flush()
    compressionReasoningDisplayRef.current?.flush()
  }, [])

  const appendCompressionTextDelta = useCallback((chunk: string) => {
    compressionTextDisplayRef.current?.push(chunk)
  }, [])

  const appendCompressionReasoningDelta = useCallback((chunk: string) => {
    compressionReasoningDisplayRef.current?.push(chunk)
  }, [])

  const resetCompressionBuffers = useCallback(() => {
    resetCompressionDisplayBuffers()
  }, [resetCompressionDisplayBuffers])

  /** 对齐 desktop stopChat：立即停止流式/压缩 UI，不等待 DB reload */
  const stopStreamingUiImmediately = useCallback(() => {
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
  }, [resetCompressionBuffers, setLoading])

  const syncTokenUsageFromSession = useCallback(
    async (sessionId: string) => {
      if (!services?.sessionRepo) return
      if (!isActiveSession(sessionId)) return
      const session = await services.sessionRepo.getSessionById(sessionId)
      if (!session) return
      if (!isActiveSession(sessionId)) return
      setTokenUsage({
        inputTokens: session.totalInputTokens ?? 0,
        outputTokens: session.totalOutputTokens ?? 0,
        cacheReadInputTokens: session.totalCacheReadInputTokens ?? 0,
        cacheWriteInputTokens: session.totalCacheWriteInputTokens ?? 0,
        totalCostMicros: session.totalCostMicros ?? 0
      })
    },
    [services, isActiveSession]
  )

  const reloadMessagesFromDb = useCallback(
    async (
      sessionId: string,
      options?: {
        preserveWindow?: boolean
        retryCount?: number
        waitForLatestUsage?: boolean
        commitToUi?: boolean
      }
    ): Promise<boolean> => {
      const run = async (): Promise<boolean> => {
        const commitToUi = options?.commitToUi ?? isActiveSession(sessionId)

        if (refreshSessionMessages) {
          const ok = await refreshSessionMessages(sessionId, { ...options, commitToUi })
          if (!ok) return false
        } else if (services && commitToUi) {
          const storageRoot = await services.pathService.getRootDirectory()
          const rows = await services.sessionManager.getMessagesBySession(sessionId, 100)
          clearSession()
          const seen = new Set<string>()
          for (const row of rows) {
            if (seen.has(row.id)) continue
            seen.add(row.id)
            addMessage(mapSessionMessageFromDb(row as any, { storageRoot }))
          }
        }

        if (commitToUi && isActiveSession(sessionId)) {
          await syncTokenUsageFromSession(sessionId)
        }

        return true
      }

      const prev = reloadInFlightRef.current
      const next = (async () => {
        if (prev) {
          try {
            await prev
          } catch {
            /* ignore */
          }
        }
        return run()
      })()
      reloadInFlightRef.current = next
      try {
        return await next
      } finally {
        if (reloadInFlightRef.current === next) {
          reloadInFlightRef.current = null
        }
      }
    },
    [
      refreshSessionMessages,
      services,
      clearSession,
      addMessage,
      syncTokenUsageFromSession,
      isActiveSession
    ]
  )

  /** 串行：后端截断 → 从 DB 刷新 UI，成功后才允许继续流式输出 */
  const truncateSessionAndSyncUi = useCallback(
    async (sessionId: string, cutoffOrderIndex: number, epoch: number): Promise<boolean> => {
      if (!services?.snapshotRepo) return false
      if (epoch !== retryEpochRef.current) return false

      await runMobileAgentDbWrite(`truncateSession(${sessionId})`, async (runtime) => {
        if (!runtime.snapshotRepo) {
          throw new Error('Snapshot repository unavailable')
        }
        await truncateSessionAfterOrderIndex(
          runtime.sessionRepo,
          runtime.snapshotRepo,
          sessionId,
          cutoffOrderIndex,
          truncateOptionsWithDiskFlush(runtime.sessionManager)
        )
      })
      if (epoch !== retryEpochRef.current) return false

      const synced = await reloadMessagesFromDb(sessionId, { preserveWindow: false })
      if (epoch !== retryEpochRef.current) return false
      return synced
    },
    [services, reloadMessagesFromDb]
  )

  useEffect(() => {
    if (!currentSessionId) {
      setTokenUsage({
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheWriteInputTokens: 0,
        totalCostMicros: 0
      })
      return
    }
    if (!isStreaming) {
      void syncTokenUsageFromSession(currentSessionId)
    }
  }, [currentSessionId, isStreaming, syncTokenUsageFromSession])

  /** 对齐 desktop useAgentStream：消费 onCompressionLifecycle / agent:compression-event */
  useEffect(() => {
    return subscribeMobileCompressionEvents((event) => {
      if (event.sessionId !== currentSessionIdRef.current) return

      if (event.type === 'start') {
        resetCompressionBuffers()
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
        appendCompressionReasoningDelta(event.chunk ?? '')
        return
      }

      if (event.type === 'delta') {
        appendCompressionTextDelta(event.chunk ?? '')
        return
      }

      if (event.type === 'finish') {
        flushCompressionDisplayBuffers()
        setIsCompressing(false)
        if (!event.ok) {
          resetCompressionBuffers()
          setCompressionText('')
          setCompressionReasoning('')
          setCompressionTriggerMessageId(null)
          return
        }

        if (isStreamingRef.current) {
          resetCompressionBuffers()
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
          await reloadMessagesFromDb(sessionId, {
            preserveWindow: false,
            retryCount: 5,
            waitForLatestUsage: true
          })
          resetCompressionBuffers()
          setCompressionText('')
          setCompressionReasoning('')
          setCompressionTriggerMessageId(null)
        })()
      }
    })
  }, [
    reloadMessagesFromDb,
    services,
    resetCompressionBuffers,
    flushCompressionDisplayBuffers,
    appendCompressionTextDelta,
    appendCompressionReasoningDelta
  ])

  const resetStreamingBuffers = useCallback(() => {
    clearStreamingDisplayBuffers()
    activeToolRef.current = null
    setActiveTool(null)
    setCompletedTools([])
  }, [clearStreamingDisplayBuffers])

  const handleToolCallStart = useCallback((toolName: string) => {
    const tool = { name: toolName, startTime: Date.now() }
    activeToolRef.current = tool
    setActiveTool(tool)
  }, [])

  const handleToolCallResult = useCallback((toolName: string, result: unknown) => {
    const startTime = activeToolRef.current?.startTime ?? Date.now()
    activeToolRef.current = null
    setActiveTool(null)
    setCompletedTools((prev) => [
      ...prev,
      { name: toolName, startTime, endTime: Date.now(), result }
    ])
  }, [])

  /** 中断当前流式/压缩 UI，避免重发或新消息与旧生成并行 */
  const interruptActiveStream = useCallback(
    (options?: { keepStreamingFlag?: boolean }) => {
      finishStreamPassRef.current += 1
      stopStreamingUiImmediately()
      if (options?.keepStreamingFlag) {
        isStreamingRef.current = true
        setIsStreaming(true)
      }
      resetStreamingBuffers()
    },
    [stopStreamingUiImmediately, resetStreamingBuffers]
  )

  // 工作区切换时中断流式生成，避免旧会话的流写入新 UI
  useEffect(() => {
    if (vaultSwitching) {
      interruptActiveStream()
    }
  }, [vaultSwitching, interruptActiveStream])

  /** 重发/编辑/重新生成前：中止旧流、释放 finalize 锁，并递增 epoch 作废进行中的异步步骤 */
  const beginRetryAction = useCallback(() => {
    const epoch = ++retryEpochRef.current
    finishStreamPassRef.current += 1
    bumpReloadEpoch?.()
    interruptActiveStream()
    resetCompressionBuffers()
    setIsCompressing(false)
    setCompressionText('')
    setCompressionReasoning('')
    setCompressionTriggerMessageId(null)
    return epoch
  }, [interruptActiveStream, resetCompressionBuffers, bumpReloadEpoch])

  const acquireRetryAction = useCallback((): number | null => {
    if (retryActionInFlightRef.current || isStreamingRef.current) return null
    retryActionInFlightRef.current = true
    setIsRetryActionBusy(true)
    return beginRetryAction()
  }, [beginRetryAction])

  const releaseRetryAction = useCallback(() => {
    retryActionInFlightRef.current = false
    pendingRetryReleaseEpochRef.current = null
    setIsRetryActionBusy(false)
  }, [])

  const releaseRetryActionIfSetupFailed = useCallback(
    (epoch: number) => {
      if (pendingRetryReleaseEpochRef.current !== null) return
      if (epoch !== retryEpochRef.current) return
      releaseRetryAction()
    },
    [releaseRetryAction]
  )

  const finishStreamInFlightRef = useRef<Promise<void> | null>(null)

  /** 流结束：先刷盘并 reload，再一次性切到列表气泡（避免 bridge 双实例整屏闪烁） */
  const finishStream = useCallback(
    async (
      sessionId: string,
      options?: { waitForLatestUsage?: boolean; releaseRetryEpoch?: number }
    ) => {
      const finishPass = ++finishStreamPassRef.current
      const releaseEpoch = options?.releaseRetryEpoch ?? null

      const runFinalize = async () => {
        streamFinalizeLockRef.current = sessionId

        setLoading(false)
        streamAbortRef.current = null

        const hasBufferedOutput =
          Boolean(streamingTextDisplayRef.current?.getFullText().trim()) ||
          Boolean(streamingReasoningDisplayRef.current?.getFullText().trim())
        if (hasBufferedOutput && isActiveSession(sessionId)) {
          flushStreamingDisplayBuffers()
        }

        try {
          try {
            await services?.sessionManager.flushSessionToDisk(sessionId)
          } catch {
            /* ignore */
          }

          if (!isActiveSession(sessionId)) return

          let reloaded = await reloadMessagesFromDb(sessionId, {
            preserveWindow: true,
            retryCount: 5,
            waitForLatestUsage: options?.waitForLatestUsage ?? false,
            commitToUi: true
          })

          if (!reloaded && isActiveSession(sessionId)) {
            reloaded = await reloadMessagesFromDb(sessionId, {
              preserveWindow: true,
              retryCount: 2,
              waitForLatestUsage: false,
              commitToUi: true
            })
          }

          if (!reloaded && isActiveSession(sessionId)) {
            await syncTokenUsageFromSession(sessionId)
          }
        } catch (e) {
          console.error('Failed to finish stream', e)
          if (isActiveSession(sessionId)) {
            await syncTokenUsageFromSession(sessionId)
          }
        } finally {
          if (streamFinalizeLockRef.current === sessionId) {
            streamFinalizeLockRef.current = null
          }

          // 作废较早的 finish（如停止后又发起新流式输出）
          if (finishPass !== finishStreamPassRef.current) {
            if (
              releaseEpoch !== null &&
              pendingRetryReleaseEpochRef.current === releaseEpoch
            ) {
              releaseRetryAction()
            }
            return
          }

          isStreamingRef.current = false
          setIsStreaming(false)
          setIsStreamBridgeActive(false)
          resetStreamingBuffers()
          if (
            releaseEpoch !== null &&
            pendingRetryReleaseEpochRef.current === releaseEpoch
          ) {
            releaseRetryAction()
          }
        }
      }

      const prev = finishStreamInFlightRef.current
      const task = (prev ? prev.then(runFinalize, runFinalize) : runFinalize()).finally(() => {
        if (finishStreamInFlightRef.current === task) {
          finishStreamInFlightRef.current = null
        }
      })
      finishStreamInFlightRef.current = task
      return task
    },
    [
      flushStreamingDisplayBuffers,
      reloadMessagesFromDb,
      resetStreamingBuffers,
      releaseRetryAction,
      setLoading,
      services,
      syncTokenUsageFromSession,
      isActiveSession
    ]
  )
  /** 对齐 desktop resend/edit：截断后复用已有用户消息 id，不再 insert 新消息 */
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
        await startAgentChat?.(
          sessionId,
          userMessage.content,
          {
            onTextDelta: appendStreamingTextDelta,
            onReasoningDelta: appendStreamingReasoningDelta,
            onToolCallStart: handleToolCallStart,
            onToolCallResult: handleToolCallResult,
            onFinish: () => {},
            onError: (err) => {
              if (userStoppedStreamRef.current || isAgentStreamAbortError(err)) return
              fail(err.message || t('app.unknown_error', '未知网络或系统错误'))
            }
          },
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
          }
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
      setLoading,
      startAgentChat,
      handleToolCallStart,
      handleToolCallResult,
      appendStreamingTextDelta,
      appendStreamingReasoningDelta
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
          await services.pathService.getRootDirectory()
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

      try {
        await startAgentChat?.(
          sessionId,
          text,
          {
            onTextDelta: appendStreamingTextDelta,
            onReasoningDelta: appendStreamingReasoningDelta,
            onToolCallStart: handleToolCallStart,
            onToolCallResult: handleToolCallResult,
            onFinish: () => {},
            onError: (err) => {
              if (userStoppedStreamRef.current || isAgentStreamAbortError(err)) return
              failStream(err.message || t('app.unknown_error', '未知网络或系统错误'))
            }
          },
          {
            providerId: currentProviderId || undefined,
            modelId: currentModelId || undefined,
            searchMode: effectiveSearchMode,
            abortSignal: claim.signal,
            userMessageId: saveResult.userMessageId,
            skipUserMessageRecording: true,
            streamClaimGeneration: claim.generation,
            attachments: saveResult.attachments
          }
        )
        await finishStream(sessionId!, { waitForLatestUsage: true })
      } catch (e: unknown) {
        if (userStoppedStreamRef.current || isAgentStreamAbortError(e)) {
          userStoppedStreamRef.current = false
          setStreamError(null)
        } else {
          const msg = e instanceof Error ? e.message : String(e)
          failStream(msg)
        }
        await finishStream(sessionId!, { waitForLatestUsage: true })
      }

      return true
    },
    [
      currentSessionId,
      currentAssistant,
      currentProviderId,
      currentModelId,
      services,
      startAgentChat,
      t,
      addMessage,
      setLoading,
      onSessionCreated,
      onSessionListRefresh,
      finishStream,
      resetStreamingBuffers,
      interruptActiveStream,
      handleToolCallStart,
      handleToolCallResult,
      appendStreamingTextDelta,
      appendStreamingReasoningDelta
    ]
  )

  const handleStop = useCallback(() => {
    const sessionId = currentSessionIdRef.current
    userStoppedStreamRef.current = true
    finishStreamPassRef.current += 1
    setStreamError(null)
    flushStreamingDisplayBuffers()
    stopStreamingUiImmediately()
    resetStreamingBuffers()
    toast.showSuccess(t('agent.stream_cancelled', '取消成功'))

    if (retryActionInFlightRef.current) {
      pendingRetryReleaseEpochRef.current = null
      releaseRetryAction()
    }

    if (sessionId) {
      void finishStream(sessionId, { waitForLatestUsage: true })
    }
  }, [
    flushStreamingDisplayBuffers,
    stopStreamingUiImmediately,
    resetStreamingBuffers,
    releaseRetryAction,
    finishStream,
    toast,
    t
  ])

  const handleRegenerate = useCallback(
    async (messageId: string) => {
      if (!currentSessionId || !services) return

      if (
        !isConfiguredProviderId(currentProviderId) ||
        !isConfiguredDialogueModelId(currentModelId)
      ) {
        toast.showInfo(t('agent.error.no_model', '请先在顶部选择一个模型'))
        return
      }

      const epoch = acquireRetryAction()
      if (epoch === null) return

      const failRegenerate = (errorMsg: string) => {
        if (epoch !== retryEpochRef.current) return
        if (userStoppedStreamRef.current || isAgentStreamAbortError(errorMsg)) return
        setStreamError(errorMsg)
      }

      try {
        const msgIndex = messages.findIndex((m) => m.id === messageId)
        if (msgIndex <= 0) {
          releaseRetryActionIfSetupFailed(epoch)
          return
        }
        const userMessage = messages[msgIndex - 1]
        if (userMessage.role !== 'user') {
          releaseRetryActionIfSetupFailed(epoch)
          return
        }

        const dbUser = await services.sessionRepo.getMessageById(userMessage.id)
        if (!dbUser || !services.snapshotRepo) {
          releaseRetryActionIfSetupFailed(epoch)
          return
        }
        if (epoch !== retryEpochRef.current) return

        const synced = await truncateSessionAndSyncUi(currentSessionId, dbUser.orderIndex, epoch)
        if (!synced) {
          releaseRetryActionIfSetupFailed(epoch)
          toast.showError(t('agent.chat.resend_failed', '重新发送失败'))
          return
        }

        await streamFromExistingUserMessage(
          currentSessionId,
          {
            id: userMessage.id,
            content: userMessage.content,
            attachments: userMessage.attachments
          },
          { retryReleaseEpoch: epoch }
        )
      } catch (e) {
        if (userStoppedStreamRef.current || isAgentStreamAbortError(e)) {
          userStoppedStreamRef.current = false
          setStreamError(null)
        } else {
          const msg = e instanceof Error ? e.message : String(e)
          failRegenerate(msg)
        }
        releaseRetryActionIfSetupFailed(epoch)
      }
    },
    [
      currentSessionId,
      services,
      messages,
      currentProviderId,
      currentModelId,
      toast,
      t,
      acquireRetryAction,
      releaseRetryActionIfSetupFailed,
      streamFromExistingUserMessage,
      truncateSessionAndSyncUi
    ]
  )

  /** 用户消息：原样重发（对齐 desktop handleResend / agent:resend） */
  const handleResend = useCallback(
    async (messageId: string) => {
      if (!currentSessionId || !services?.snapshotRepo) return
      const storeMsg = messages.find((m) => m.id === messageId)
      if (!storeMsg || storeMsg.role !== 'user') return

      const epoch = acquireRetryAction()
      if (epoch === null) return

      try {
        const dbMsg = await services.sessionRepo.getMessageById(messageId)
        if (!dbMsg) {
          releaseRetryActionIfSetupFailed(epoch)
          return
        }
        if (epoch !== retryEpochRef.current) return

        const synced = await truncateSessionAndSyncUi(currentSessionId, dbMsg.orderIndex, epoch)
        if (!synced) {
          releaseRetryActionIfSetupFailed(epoch)
          toast.showError(t('agent.chat.resend_failed', '重新发送失败'))
          return
        }

        await streamFromExistingUserMessage(
          currentSessionId,
          {
            id: messageId,
            content: storeMsg.content,
            attachments: storeMsg.attachments
          },
          { retryReleaseEpoch: epoch }
        )
      } catch (e) {
        if (epoch !== retryEpochRef.current) return
        console.error('Failed to resend message', e)
        toast.showError(t('agent.chat.resend_failed', '重新发送失败'))
        releaseRetryActionIfSetupFailed(epoch)
      }
    },
    [
      currentSessionId,
      services,
      messages,
      acquireRetryAction,
      releaseRetryActionIfSetupFailed,
      streamFromExistingUserMessage,
      truncateSessionAndSyncUi,
      toast,
      t
    ]
  )

  /** 用户消息：编辑后截断并重发（对齐 desktop handleResendEdit / agent:edit-message） */
  const handleEditMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!currentSessionId || !services?.snapshotRepo || !newContent.trim()) return

      const epoch = acquireRetryAction()
      if (epoch === null) return

      try {
        const dbMsg = await services.sessionRepo.getMessageById(messageId)
        if (!dbMsg || dbMsg.role !== 'user') {
          releaseRetryActionIfSetupFailed(epoch)
          return
        }
        if (epoch !== retryEpochRef.current) return

        await services.sessionRepo.updateMessageTextPart(messageId, newContent.trim())
        if (epoch !== retryEpochRef.current) return

        const synced = await truncateSessionAndSyncUi(currentSessionId, dbMsg.orderIndex, epoch)
        if (!synced) {
          releaseRetryActionIfSetupFailed(epoch)
          toast.showError(t('agent.chat.resend_failed', '重新发送失败'))
          return
        }

        const storeMsg = messages.find((m) => m.id === messageId)
        await streamFromExistingUserMessage(
          currentSessionId,
          {
            id: messageId,
            content: newContent.trim(),
            attachments: storeMsg?.attachments
          },
          { retryReleaseEpoch: epoch }
        )
      } catch (e) {
        if (epoch !== retryEpochRef.current) return
        console.error('Failed to edit message', e)
        toast.showError(t('agent.chat.resend_failed', '重新发送失败'))
        releaseRetryActionIfSetupFailed(epoch)
      }
    },
    [
      currentSessionId,
      services,
      messages,
      acquireRetryAction,
      releaseRetryActionIfSetupFailed,
      streamFromExistingUserMessage,
      truncateSessionAndSyncUi,
      toast,
      t
    ]
  )

  /** AI 消息：仅保存编辑内容，不重新生成（对齐 desktop handleSaveEdit） */
  const handleSaveAssistantEdit = useCallback(
    async (messageId: string, newContent: string) => {
      if (!services || !newContent.trim()) return
      try {
        await services.sessionRepo.updateMessageTextPart(messageId, newContent.trim())
        updateMessage(messageId, { content: newContent.trim() })
      } catch (e) {
        console.error('Failed to save assistant message edit', e)
        toast.showError(t('common.save_failed', '保存失败'))
      }
    },
    [services, updateMessage, toast, t]
  )

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!currentSessionId || !services) return
      const confirmed = await dialog.confirm(
        t('agent.chat.delete_msg_confirm', '您确定要删除这条消息历史吗？此操作不可逆转。'),
        { confirmText: t('common.delete', '删除'), destructive: true }
      )
      if (!confirmed) return
      bumpReloadEpoch?.()
      try {
        await services.sessionRepo.deleteMessageAndFollowing(currentSessionId, messageId)
        if (services.snapshotRepo) {
          await reconcileCompressionStateAfterTruncate(
            services.sessionRepo,
            services.snapshotRepo,
            currentSessionId
          )
        }
        const synced = await reloadMessagesFromDb(currentSessionId, { preserveWindow: false })
        if (!synced) {
          toast.showError(t('common.delete_failed', '删除失败'))
        }
      } catch (e) {
        console.error('Failed to delete message', e)
        toast.showError(t('common.delete_failed', '删除失败'))
      }
    },
    [currentSessionId, services, dialog, t, toast, reloadMessagesFromDb, bumpReloadEpoch]
  )

  const updateTokenUsage = useCallback((usage: Partial<TokenUsage>) => {
    setTokenUsage((prev) => ({ ...prev, ...usage }))
  }, [])

  return {
    isStreaming,
    isStreamBridgeActive,
    isRetryActionBusy,
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
    handleSend,
    handleStop,
    handleRegenerate,
    handleResend,
    handleEditMessage,
    handleSaveAssistantEdit,
    handleDeleteMessage,
    updateTokenUsage
  }
}
