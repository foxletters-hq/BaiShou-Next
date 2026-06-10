import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNativeToast, useDialog } from '@baishou/ui/native'
import { useAgentStore } from '@baishou/store'
import { reconcileCompressionStateAfterTruncate, truncateSessionAfterOrderIndex } from '@baishou/ai'
import { useBaishou } from '../providers/BaishouProvider'
import { saveUserMessage } from '../services/mobile-agent-message.service'
import { buildInsertSessionInput } from '../utils/session-input.util'
import { mapSessionMessageFromDb } from '../utils/map-session-message.util'
import { mapSavedAttachmentsForMobileUi } from '../utils/mobile-attachment-ui.util'
import { subscribeMobileCompressionEvents } from '../services/mobile-compression-event.service'

interface TokenUsage {
  inputTokens: number
  outputTokens: number
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
  searchMode?: boolean
) {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { addMessage, updateMessage, setLoading, clearSession, messages } = useAgentStore()
  const { startAgentChat, services } = useBaishou()

  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [streamingReasoning, setStreamingReasoning] = useState('')
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({
    inputTokens: 0,
    outputTokens: 0,
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
  const abortControllerRef = useRef<AbortController | null>(null)
  const currentSessionIdRef = useRef(currentSessionId)
  currentSessionIdRef.current = currentSessionId

  const reloadMessagesFromDb = useCallback(
    async (sessionId: string) => {
      if (!services) return
      const rows = await services.sessionManager.getMessagesBySession(sessionId, 100)
      clearSession()
      for (const row of rows) {
        addMessage(mapSessionMessageFromDb(row as any))
      }
    },
    [services, clearSession, addMessage]
  )

  const syncTokenUsageFromMessages = useCallback((sessionMessages: typeof messages) => {
    const assistantMessages = sessionMessages.filter((m) => m.role === 'assistant')
    setTokenUsage({
      inputTokens: assistantMessages.reduce(
        (sum, m) => sum + ((m as { inputTokens?: number }).inputTokens || 0),
        0
      ),
      outputTokens: assistantMessages.reduce(
        (sum, m) => sum + ((m as { outputTokens?: number }).outputTokens || 0),
        0
      ),
      totalCostMicros: assistantMessages.reduce(
        (sum, m) => sum + ((m as { costMicros?: number }).costMicros || 0),
        0
      )
    })
  }, [])

  useEffect(() => {
    if (!currentSessionId) {
      setTokenUsage({ inputTokens: 0, outputTokens: 0, totalCostMicros: 0 })
      return
    }
    if (!isStreaming) {
      syncTokenUsageFromMessages(messages)
    }
  }, [currentSessionId, messages, isStreaming, syncTokenUsageFromMessages])

  /** 对齐 desktop useAgentStream：消费 onCompressionLifecycle / agent:compression-event */
  useEffect(() => {
    return subscribeMobileCompressionEvents((event) => {
      if (event.sessionId !== currentSessionIdRef.current) return

      if (event.type === 'start') {
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
        setCompressionReasoning((prev) => prev + (event.chunk ?? ''))
        return
      }

      if (event.type === 'delta') {
        setCompressionText((prev) => prev + (event.chunk ?? ''))
        return
      }

      if (event.type === 'finish') {
        setIsCompressing(false)
        if (!event.ok) {
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
          await reloadMessagesFromDb(sessionId)
          setCompressionText('')
          setCompressionReasoning('')
          setCompressionTriggerMessageId(null)
        })()
      }
    })
  }, [reloadMessagesFromDb, services])

  const resetStreamingBuffers = useCallback(() => {
    setStreamingText('')
    setStreamingReasoning('')
    setActiveTool(null)
    setCompletedTools([])
  }, [])

  /** 中断当前流式/压缩 UI，避免重发或新消息与旧生成并行 */
  const interruptActiveStream = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setIsStreaming(false)
    setIsCompressing(false)
    setLoading(false)
    setCompressionText('')
    setCompressionReasoning('')
    setCompressionTriggerMessageId(null)
    resetStreamingBuffers()
  }, [resetStreamingBuffers, setLoading])

  /** 流结束：先落库刷新，再收起 StreamingBubble（对齐 desktop，避免双气泡） */
  const finishStream = useCallback(
    async (sessionId: string) => {
      setLoading(false)
      abortControllerRef.current = null
      try {
        await reloadMessagesFromDb(sessionId)
      } finally {
        setIsStreaming(false)
        resetStreamingBuffers()
      }
    },
    [reloadMessagesFromDb, resetStreamingBuffers, setLoading]
  )

  /** 对齐 desktop resend/edit：截断后复用已有用户消息 id，不再 insert 新消息 */
  const streamFromExistingUserMessage = useCallback(
    async (
      sessionId: string,
      userMessage: { id: string; content: string; attachments?: unknown[] }
    ) => {
      if (!currentProviderId || !currentModelId) {
        toast.showInfo(t('agent.error.no_model', '请先在顶部选择一个模型'))
        return
      }

      const fail = (errorMsg: string) => {
        setStreamError(errorMsg)
        void finishStream(sessionId)
      }

      interruptActiveStream()
      abortControllerRef.current = new AbortController()
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
            onToolCallStart: (toolName) => setActiveTool({ name: toolName, startTime: Date.now() }),
            onToolCallResult: (toolName, result) => {
              setActiveTool(null)
              setCompletedTools((prev) => [
                ...prev,
                { name: toolName, startTime: Date.now(), endTime: Date.now(), result }
              ])
            },
            onFinish: () => {
              void finishStream(sessionId)
            },
            onError: (err) => {
              fail(err.message || t('app.unknown_error', '未知网络或系统错误'))
            }
          },
          {
            providerId: currentProviderId || undefined,
            modelId: currentModelId || undefined,
            searchMode: searchModeRef.current,
            abortSignal: abortControllerRef.current.signal,
            userMessageId: userMessage.id,
            skipUserMessageRecording: true,
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
      startAgentChat
    ]
  )

  const handleSend = useCallback(
    async (text: string, attachments?: unknown[], sendSearchMode?: boolean) => {
      if (!text.trim() || !services) return

      if (!currentProviderId || !currentModelId) {
        toast.showInfo(t('agent.error.no_model', '请先在顶部选择一个模型'))
        return
      }

      const effectiveSearchMode = sendSearchMode ?? searchModeRef.current ?? false
      let sessionId = currentSessionId

      if (!sessionId) {
        try {
          const newSessionId = Date.now().toString()
          await services.sessionManager.upsertSession(
            buildInsertSessionInput({
              id: newSessionId,
              title: text.substring(0, 20) || t('agent.sessions.default_title', '新对话'),
              assistantId: currentAssistant?.id,
              providerId: currentProviderId || undefined,
              modelId: currentModelId || undefined
            })
          )
          sessionId = newSessionId
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

      interruptActiveStream()
      abortControllerRef.current = new AbortController()

      addMessage({
        id: saveResult.userMessageId,
        role: 'user',
        content: text,
        timestamp: new Date(),
        attachments: mapSavedAttachmentsForMobileUi(saveResult.attachments) as any
      })

      setLoading(true)
      setIsStreaming(true)
      setStreamError(null)
      resetStreamingBuffers()

      const failStream = (errorMsg: string, sessionIdForReload: string) => {
        setStreamError(errorMsg)
        void finishStream(sessionIdForReload)
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
            onToolCallStart: (toolName: string) => {
              setActiveTool({ name: toolName, startTime: Date.now() })
            },
            onToolCallResult: (toolName: string, result: unknown) => {
              setActiveTool(null)
              setCompletedTools((prev) => [
                ...prev,
                { name: toolName, startTime: Date.now(), endTime: Date.now(), result }
              ])
            },
            onFinish: () => {
              void finishStream(sessionId!)
            },
            onError: (err) => {
              failStream(err.message || t('app.unknown_error', '未知网络或系统错误'), sessionId!)
            }
          },
          {
            providerId: currentProviderId || undefined,
            modelId: currentModelId || undefined,
            searchMode: effectiveSearchMode,
            abortSignal: abortControllerRef.current.signal,
            userMessageId: saveResult.userMessageId,
            skipUserMessageRecording: true,
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
      finishStream,
      resetStreamingBuffers,
      interruptActiveStream
    ]
  )

  const handleStop = useCallback(() => {
    interruptActiveStream()
  }, [interruptActiveStream])

  const handleRegenerate = useCallback(
    async (messageId: string) => {
      if (!currentSessionId || !services) return

      if (!currentProviderId || !currentModelId) {
        toast.showInfo(t('agent.error.no_model', '请先在顶部选择一个模型'))
        return
      }

      const failRegenerate = (errorMsg: string) => {
        setStreamError(errorMsg)
        void finishStream(currentSessionId)
      }

      try {
        const msgIndex = messages.findIndex((m) => m.id === messageId)
        if (msgIndex <= 0) return
        const userMessage = messages[msgIndex - 1]
        if (userMessage.role !== 'user') return

        const dbUser = await services.sessionRepo.getMessageById(userMessage.id)
        if (!dbUser || !services.snapshotRepo) return
        await truncateSessionAfterOrderIndex(
          services.sessionRepo,
          services.snapshotRepo,
          currentSessionId,
          dbUser.orderIndex
        )
        await reloadMessagesFromDb(currentSessionId)
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

      try {
        const dbMsg = await services.sessionRepo.getMessageById(messageId)
        if (!dbMsg) return

        await truncateSessionAfterOrderIndex(
          services.sessionRepo,
          services.snapshotRepo,
          currentSessionId,
          dbMsg.orderIndex
        )
        await reloadMessagesFromDb(currentSessionId)
        await streamFromExistingUserMessage(currentSessionId, {
          id: messageId,
          content: storeMsg.content,
          attachments: storeMsg.attachments
        })
      } catch (e) {
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

      try {
        const dbMsg = await services.sessionRepo.getMessageById(messageId)
        if (!dbMsg || dbMsg.role !== 'user') return

        await services.sessionRepo.updateMessageTextPart(messageId, newContent.trim())
        await truncateSessionAfterOrderIndex(
          services.sessionRepo,
          services.snapshotRepo,
          currentSessionId,
          dbMsg.orderIndex
        )
        await reloadMessagesFromDb(currentSessionId)

        const storeMsg = messages.find((m) => m.id === messageId)
        await streamFromExistingUserMessage(currentSessionId, {
          id: messageId,
          content: newContent.trim(),
          attachments: storeMsg?.attachments
        })
      } catch (e) {
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
        await reloadMessagesFromDb(currentSessionId)
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
