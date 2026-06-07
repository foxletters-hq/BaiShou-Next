import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNativeToast, useDialog } from '@baishou/ui/native'
import { useAgentStore } from '@baishou/store'
import { reconcileCompressionStateAfterTruncate, truncateSessionAfterOrderIndex } from '@baishou/ai'
import { useBaishou } from '../providers/BaishouProvider'
import { saveUserMessage } from '../services/mobile-agent-message.service'
import { buildInsertSessionInput } from '../utils/session-input.util'
import { mapSessionMessageFromDb } from '../utils/map-session-message.util'

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

  const searchModeRef = useRef(searchMode)
  searchModeRef.current = searchMode
  const abortControllerRef = useRef<AbortController | null>(null)

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

  const resetStreamingBuffers = useCallback(() => {
    setStreamingText('')
    setStreamingReasoning('')
    setActiveTool(null)
    setCompletedTools([])
  }, [])

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

      abortControllerRef.current = new AbortController()

      addMessage({
        id: saveResult.userMessageId,
        role: 'user',
        content: text,
        timestamp: new Date(),
        attachments: saveResult.attachments as any
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
            onFinish: (result?: {
              inputTokens?: number
              outputTokens?: number
              costMicros?: number
            }) => {
              if (result) {
                setTokenUsage((prev) => ({
                  inputTokens: prev.inputTokens + (result.inputTokens || 0),
                  outputTokens: prev.outputTokens + (result.outputTokens || 0),
                  totalCostMicros: prev.totalCostMicros + (result.costMicros || 0)
                }))
              }
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
      resetStreamingBuffers
    ]
  )

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

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

        abortControllerRef.current = new AbortController()
        setLoading(true)
        setIsStreaming(true)
        setStreamError(null)
        resetStreamingBuffers()

        let currentText = ''
        await startAgentChat?.(
          currentSessionId,
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
              void finishStream(currentSessionId)
            },
            onError: (err) => {
              failRegenerate(err.message || t('app.unknown_error', '未知网络或系统错误'))
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
        failRegenerate(msg)
      }
    },
    [
      currentSessionId,
      services,
      messages,
      startAgentChat,
      currentProviderId,
      currentModelId,
      setLoading,
      finishStream,
      resetStreamingBuffers
    ]
  )

  /** 用户消息：编辑后截断并重发 */
  const handleEditMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!currentSessionId || !services) return
      try {
        const dbMsg = await services.sessionRepo.getMessageById(messageId)
        if (!dbMsg) return
        await services.sessionRepo.deleteMessagesAfter(currentSessionId, dbMsg.orderIndex - 1)
        await reloadMessagesFromDb(currentSessionId)
        await handleSend(newContent)
      } catch (e) {
        console.error('Failed to edit message', e)
      }
    },
    [currentSessionId, services, handleSend, reloadMessagesFromDb]
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
    streamError,
    streamingText,
    streamingReasoning,
    tokenUsage,
    activeTool,
    completedTools,
    handleSend,
    handleStop,
    handleRegenerate,
    handleEditMessage,
    handleSaveAssistantEdit,
    handleDeleteMessage,
    updateTokenUsage
  }
}
