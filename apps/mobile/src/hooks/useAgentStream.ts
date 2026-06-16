import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNativeToast, useDialog } from '@baishou/ui/native'
import { useAgentStore } from '@baishou/store'
import {
  reconcileCompressionStateAfterTruncate,
  truncateSessionAfterOrderIndex,
  claimAgentStreamSession
} from '@baishou/ai'
import {
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  deriveSessionTitleFromUserText
} from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'
import { saveUserMessage } from '../services/mobile-agent-message.service'
import { buildInsertSessionInput } from '../utils/session-input.util'
import { mapSessionMessageFromDb } from '../utils/map-session-message.util'
import { mapSavedAttachmentsForMobileUi } from '../utils/mobile-attachment-ui.util'
import { subscribeMobileCompressionEvents } from '../services/mobile-compression-event.service'

const COMPRESSION_DELTA_RENDER_INTERVAL_MS = 80

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
  ) => Promise<boolean>
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
  const compressionTextBufferRef = useRef('')
  const compressionReasoningBufferRef = useRef('')
  const compressionFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamFinalizeLockRef = useRef<string | null>(null)

  const isActiveSession = useCallback(
    (sessionId: string) => currentSessionIdRef.current === sessionId,
    []
  )

  const clearCompressionFlushTimer = useCallback(() => {
    if (!compressionFlushTimerRef.current) return
    clearTimeout(compressionFlushTimerRef.current)
    compressionFlushTimerRef.current = null
  }, [])

  const flushCompressionBuffersToState = useCallback(() => {
    setCompressionText(compressionTextBufferRef.current)
    setCompressionReasoning(compressionReasoningBufferRef.current)
  }, [])

  const scheduleCompressionFlush = useCallback(() => {
    if (compressionFlushTimerRef.current) return
    compressionFlushTimerRef.current = setTimeout(() => {
      compressionFlushTimerRef.current = null
      flushCompressionBuffersToState()
    }, COMPRESSION_DELTA_RENDER_INTERVAL_MS)
  }, [flushCompressionBuffersToState])

  const resetCompressionBuffers = useCallback(() => {
    compressionTextBufferRef.current = ''
    compressionReasoningBufferRef.current = ''
    clearCompressionFlushTimer()
  }, [clearCompressionFlushTimer])

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
        compressionReasoningBufferRef.current += event.chunk ?? ''
        scheduleCompressionFlush()
        return
      }

      if (event.type === 'delta') {
        compressionTextBufferRef.current += event.chunk ?? ''
        scheduleCompressionFlush()
        return
      }

      if (event.type === 'finish') {
        clearCompressionFlushTimer()
        flushCompressionBuffersToState()
        setIsCompressing(false)
        if (!event.ok) {
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
    clearCompressionFlushTimer,
    flushCompressionBuffersToState,
    scheduleCompressionFlush
  ])

  useEffect(() => () => clearCompressionFlushTimer(), [clearCompressionFlushTimer])

  const resetStreamingBuffers = useCallback(() => {
    setStreamingText('')
    setStreamingReasoning('')
    activeToolRef.current = null
    setActiveTool(null)
    setCompletedTools([])
  }, [])

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
      streamAbortRef.current?.()
      streamAbortRef.current = null
      if (!options?.keepStreamingFlag) {
        setIsStreaming(false)
      }
      setIsCompressing(false)
      setLoading(false)
      resetCompressionBuffers()
      setCompressionText('')
      setCompressionReasoning('')
      setCompressionTriggerMessageId(null)
      resetStreamingBuffers()
    },
    [resetCompressionBuffers, resetStreamingBuffers, setLoading]
  )

  // 工作区切换时中断流式生成，避免旧会话的流写入新 UI
  useEffect(() => {
    if (vaultSwitching) {
      interruptActiveStream()
    }
  }, [vaultSwitching, interruptActiveStream])

  /** 流结束：先从 DB 刷新消息，再收起 StreamingBubble，避免列表高度突变 */
  const finishStream = useCallback(
    async (sessionId: string, options?: { waitForLatestUsage?: boolean }) => {
      if (streamFinalizeLockRef.current === sessionId) return
      streamFinalizeLockRef.current = sessionId

      setLoading(false)
      streamAbortRef.current = null

      try {
        try {
          await services?.sessionManager.flushSessionToDisk(sessionId)
        } catch {
          /* ignore */
        }

        if (!isActiveSession(sessionId)) return

        let reloaded = await reloadMessagesFromDb(sessionId, {
          preserveWindow: false,
          retryCount: 5,
          waitForLatestUsage: options?.waitForLatestUsage ?? false,
          commitToUi: true
        })

        if (!reloaded && isActiveSession(sessionId)) {
          reloaded = await reloadMessagesFromDb(sessionId, {
            preserveWindow: false,
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
        setIsStreaming(false)
        resetStreamingBuffers()
        if (streamFinalizeLockRef.current === sessionId) {
          streamFinalizeLockRef.current = null
        }
      }
    },
    [
      reloadMessagesFromDb,
      resetStreamingBuffers,
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
      userMessage: { id: string; content: string; attachments?: unknown[] }
    ) => {
      if (
        !isConfiguredProviderId(currentProviderId) ||
        !isConfiguredDialogueModelId(currentModelId)
      ) {
        toast.showInfo(t('agent.error.no_model', '请先在顶部选择一个模型'))
        return
      }

      const fail = (errorMsg: string) => {
        setStreamError(errorMsg)
        void finishStream(sessionId, { waitForLatestUsage: true })
      }

      interruptActiveStream()
      const claim = claimAgentStreamSession(sessionId)
      streamAbortRef.current = claim.abort
      setLoading(true)
      setIsStreaming(true)
      setStreamError(null)
      resetStreamingBuffers()

      let currentText = ''
      try {
        await startAgentChat?.(
          sessionId,
          userMessage.content,
          {
            onTextDelta: (chunk) => {
              currentText += chunk
              setStreamingText(currentText)
            },
            onReasoningDelta: (chunk) => setStreamingReasoning((prev) => prev + chunk),
            onToolCallStart: handleToolCallStart,
            onToolCallResult: handleToolCallResult,
            onFinish: () => {
              void finishStream(sessionId, { waitForLatestUsage: true })
            },
            onError: (err) => {
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
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        fail(msg)
      }
    },
    [
      currentProviderId,
      currentModelId,
      toast,
      t,
      finishStream,
      interruptActiveStream,
      resetStreamingBuffers,
      setLoading,
      startAgentChat,
      handleToolCallStart,
      handleToolCallResult
    ]
  )

  const handleSend = useCallback(
    async (text: string, attachments?: unknown[], sendSearchMode?: boolean) => {
      const hasText = Boolean(text.trim())
      const hasAttachments = Boolean(attachments?.length)
      if ((!hasText && !hasAttachments) || !services) return

      if (
        !isConfiguredProviderId(currentProviderId) ||
        !isConfiguredDialogueModelId(currentModelId)
      ) {
        toast.showInfo(t('agent.error.no_model', '请先在顶部选择一个模型'))
        return
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
          await services.sessionManager.upsertSession(
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
          sessionId = newSessionId
          setLoading(true)
          setIsStreaming(true)
          onSessionCreated?.(newSessionId)
        } catch (e) {
          console.error('Failed to create session', e)
          toast.showError(
            t('agent.error.create_session', '由于系统原因创建会话失败: {{msg}}', { msg: '' })
          )
          return
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
        return
      }

      if (wasNewSession) {
        onSessionListRefresh?.()
      }

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

      const failStream = (errorMsg: string, sessionIdForReload: string) => {
        setStreamError(errorMsg)
        void finishStream(sessionIdForReload, { waitForLatestUsage: true })
      }

      try {
        let currentText = ''
        await startAgentChat?.(
          sessionId,
          text,
          {
            onTextDelta: (chunk) => {
              currentText += chunk
              setStreamingText(currentText)
            },
            onReasoningDelta: (chunk) => {
              setStreamingReasoning((prev) => prev + chunk)
            },
            onToolCallStart: handleToolCallStart,
            onToolCallResult: handleToolCallResult,
            onFinish: () => {
              void finishStream(sessionId!, { waitForLatestUsage: true })
            },
            onError: (err) => {
              failStream(err.message || t('app.unknown_error', '未知网络或系统错误'), sessionId!)
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
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        failStream(msg, sessionId!)
      }
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
      handleToolCallResult
    ]
  )

  const handleStop = useCallback(() => {
    const sessionId = currentSessionIdRef.current
    streamAbortRef.current?.()
    streamAbortRef.current = null
    setStreamError(null)
    if (sessionId) {
      void finishStream(sessionId, { waitForLatestUsage: true })
    } else {
      interruptActiveStream()
    }
  }, [finishStream, interruptActiveStream])

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

      const epoch = ++retryEpochRef.current

      const failRegenerate = (errorMsg: string) => {
        if (epoch !== retryEpochRef.current) return
        setStreamError(errorMsg)
        void finishStream(currentSessionId, { waitForLatestUsage: true })
      }

      try {
        const msgIndex = messages.findIndex((m) => m.id === messageId)
        if (msgIndex <= 0) return
        const userMessage = messages[msgIndex - 1]
        if (userMessage.role !== 'user') return

        const dbUser = await services.sessionRepo.getMessageById(userMessage.id)
        if (!dbUser || !services.snapshotRepo) return
        if (epoch !== retryEpochRef.current) return

        await truncateSessionAfterOrderIndex(
          services.sessionRepo,
          services.snapshotRepo,
          currentSessionId,
          dbUser.orderIndex
        )
        if (epoch !== retryEpochRef.current) return

        await reloadMessagesFromDb(currentSessionId, { preserveWindow: false })
        if (epoch !== retryEpochRef.current) return

        await streamFromExistingUserMessage(currentSessionId, {
          id: userMessage.id,
          content: userMessage.content,
          attachments: userMessage.attachments
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        failRegenerate(msg)
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
      finishStream,
      streamFromExistingUserMessage,
      reloadMessagesFromDb
    ]
  )

  /** 用户消息：原样重发（对齐 desktop handleResend / agent:resend） */
  const handleResend = useCallback(
    async (messageId: string) => {
      if (!currentSessionId || !services?.snapshotRepo) return
      const storeMsg = messages.find((m) => m.id === messageId)
      if (!storeMsg || storeMsg.role !== 'user') return

      const epoch = ++retryEpochRef.current

      try {
        const dbMsg = await services.sessionRepo.getMessageById(messageId)
        if (!dbMsg) return
        if (epoch !== retryEpochRef.current) return

        await truncateSessionAfterOrderIndex(
          services.sessionRepo,
          services.snapshotRepo,
          currentSessionId,
          dbMsg.orderIndex
        )
        if (epoch !== retryEpochRef.current) return

        await reloadMessagesFromDb(currentSessionId, { preserveWindow: false })
        if (epoch !== retryEpochRef.current) return

        await streamFromExistingUserMessage(currentSessionId, {
          id: messageId,
          content: storeMsg.content,
          attachments: storeMsg.attachments
        })
      } catch (e) {
        if (epoch !== retryEpochRef.current) return
        console.error('Failed to resend message', e)
        toast.showError(t('agent.chat.resend_failed', '重新发送失败'))
      }
    },
    [
      currentSessionId,
      services,
      messages,
      reloadMessagesFromDb,
      streamFromExistingUserMessage,
      toast,
      t
    ]
  )

  /** 用户消息：编辑后截断并重发（对齐 desktop handleResendEdit / agent:edit-message） */
  const handleEditMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!currentSessionId || !services?.snapshotRepo || !newContent.trim()) return

      const epoch = ++retryEpochRef.current

      try {
        const dbMsg = await services.sessionRepo.getMessageById(messageId)
        if (!dbMsg || dbMsg.role !== 'user') return
        if (epoch !== retryEpochRef.current) return

        await services.sessionRepo.updateMessageTextPart(messageId, newContent.trim())
        if (epoch !== retryEpochRef.current) return

        await truncateSessionAfterOrderIndex(
          services.sessionRepo,
          services.snapshotRepo,
          currentSessionId,
          dbMsg.orderIndex
        )
        if (epoch !== retryEpochRef.current) return

        await reloadMessagesFromDb(currentSessionId, { preserveWindow: false })
        if (epoch !== retryEpochRef.current) return

        const storeMsg = messages.find((m) => m.id === messageId)
        await streamFromExistingUserMessage(currentSessionId, {
          id: messageId,
          content: newContent.trim(),
          attachments: storeMsg?.attachments
        })
      } catch (e) {
        if (epoch !== retryEpochRef.current) return
        console.error('Failed to edit message', e)
        toast.showError(t('agent.chat.resend_failed', '重新发送失败'))
      }
    },
    [
      currentSessionId,
      services,
      messages,
      reloadMessagesFromDb,
      streamFromExistingUserMessage,
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
      try {
        await services.sessionRepo.deleteMessageAndFollowing(currentSessionId, messageId)
        if (services.snapshotRepo) {
          await reconcileCompressionStateAfterTruncate(
            services.sessionRepo,
            services.snapshotRepo,
            currentSessionId
          )
        }
        await reloadMessagesFromDb(currentSessionId, { preserveWindow: false })
      } catch (e) {
        console.error('Failed to delete message', e)
        toast.showError(t('common.delete_failed', '删除失败'))
      }
    },
    [currentSessionId, services, dialog, t, toast, reloadMessagesFromDb]
  )

  const updateTokenUsage = useCallback((usage: Partial<TokenUsage>) => {
    setTokenUsage((prev) => ({ ...prev, ...usage }))
  }, [])

  return {
    isStreaming,
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
