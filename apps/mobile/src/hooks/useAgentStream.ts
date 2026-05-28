import { useState, useRef, useCallback } from 'react'
import { Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAgentStore } from '@baishou/store'
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

  const handleSend = useCallback(
    async (text: string, attachments?: unknown[], sendSearchMode?: boolean) => {
      if (!text.trim() || !services) return

      const effectiveSearchMode = sendSearchMode ?? searchModeRef.current ?? false
      let sessionId = currentSessionId

      if (!sessionId) {
        try {
          const newSessionId = Date.now().toString()
          await services.sessionManager.upsertSession(
            buildInsertSessionInput({
              id: newSessionId,
              title: text.substring(0, 20) || t('agent.sessions.newChat', '新对话'),
              assistantId: currentAssistant?.id,
              providerId: currentProviderId || undefined,
              modelId: currentModelId || undefined
            })
          )
          sessionId = newSessionId
          onSessionCreated?.(newSessionId)
        } catch (e) {
          console.error('Failed to create session', e)
          Alert.alert(t('common.error', '错误'), t('agent.sessions.createFailed', '创建会话失败'))
          return
        }
      }

      const saveResult = await saveUserMessage(
        services.sessionRepo,
        services.sessionManager,
        services.pathService,
        {
          sessionId,
          text,
          attachments,
          modelId: currentModelId || undefined,
          providerType: currentProviderId || undefined
        }
      )
      if ('error' in saveResult) {
        Alert.alert(t('common.error', '错误'), saveResult.error)
        return
      }

      abortControllerRef.current = new AbortController()
      const assistantMessageId = `${saveResult.userMessageId}-assistant-pending`

      addMessage({
        id: saveResult.userMessageId,
        role: 'user',
        content: text,
        timestamp: new Date(),
        attachments: saveResult.attachments as any
      })
      addMessage({
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      })

      setLoading(true)
      setIsStreaming(true)
      setStreamingText('')
      setStreamingReasoning('')
      setActiveTool(null)
      setCompletedTools([])

      try {
        let currentText = ''
        await startAgentChat?.(
          sessionId,
          text,
          {
            onTextDelta: (chunk) => {
              currentText += chunk
              setStreamingText(currentText)
              updateMessage(assistantMessageId, { content: currentText })
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
              setLoading(false)
              setIsStreaming(false)
              abortControllerRef.current = null
              if (result) {
                setTokenUsage((prev) => ({
                  inputTokens: prev.inputTokens + (result.inputTokens || 0),
                  outputTokens: prev.outputTokens + (result.outputTokens || 0),
                  totalCostMicros: prev.totalCostMicros + (result.costMicros || 0)
                }))
              }
              void reloadMessagesFromDb(sessionId!)
            },
            onError: (err) => {
              setLoading(false)
              setIsStreaming(false)
              abortControllerRef.current = null
              const errorMsg = err.message || ''
              let displayMsg = errorMsg
              if (errorMsg.includes('API key') || errorMsg.includes('apiKey')) {
                displayMsg = t('agent.error.api_key', 'API Key 已过期或无效，请在设置中重新配置。')
              } else if (errorMsg.includes('rate limit') || errorMsg.includes('429')) {
                displayMsg = t('agent.error.rate_limit', '请求过于频繁，请稍后再试。')
              } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
                displayMsg = t('agent.error.network', '网络连接失败，请检查网络设置。')
              } else if (errorMsg.includes('timeout')) {
                displayMsg = t('agent.error.timeout', '请求响应超时，请稍后再试。')
              }
              updateMessage(assistantMessageId, {
                content: currentText + '\n\n[ERR] ' + displayMsg
              })
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
        setLoading(false)
        setIsStreaming(false)
        abortControllerRef.current = null
        const msg = e instanceof Error ? e.message : String(e)
        updateMessage(assistantMessageId, { content: '[系统错误] ' + msg })
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
      updateMessage,
      setLoading,
      onSessionCreated,
      reloadMessagesFromDb
    ]
  )

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setLoading(false)
    setIsStreaming(false)
  }, [setLoading])

  const handleRegenerate = useCallback(
    async (messageId: string) => {
      if (!currentSessionId || !services) return
      try {
        const msgIndex = messages.findIndex((m) => m.id === messageId)
        if (msgIndex <= 0) return
        const userMessage = messages[msgIndex - 1]
        if (userMessage.role !== 'user') return

        const dbUser = await services.sessionRepo.getMessageById(userMessage.id)
        if (!dbUser) return
        await services.sessionRepo.deleteMessagesAfter(currentSessionId, dbUser.orderIndex)
        await reloadMessagesFromDb(currentSessionId)

        abortControllerRef.current = new AbortController()
        const assistantMessageId = `${userMessage.id}-assistant-pending`
        addMessage({
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date()
        })
        setLoading(true)
        setIsStreaming(true)
        setStreamingText('')

        let currentText = ''
        await startAgentChat?.(
          currentSessionId,
          userMessage.content,
          {
            onTextDelta: (chunk) => {
              currentText += chunk
              setStreamingText(currentText)
              updateMessage(assistantMessageId, { content: currentText })
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
              setLoading(false)
              setIsStreaming(false)
              abortControllerRef.current = null
              void reloadMessagesFromDb(currentSessionId)
            },
            onError: (err) => {
              setLoading(false)
              setIsStreaming(false)
              abortControllerRef.current = null
              updateMessage(assistantMessageId, {
                content: currentText + '\n\n[ERR] ' + err.message
              })
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
        console.error('Failed to regenerate', e)
      }
    },
    [
      currentSessionId,
      services,
      messages,
      startAgentChat,
      currentProviderId,
      currentModelId,
      addMessage,
      updateMessage,
      setLoading,
      reloadMessagesFromDb
    ]
  )

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

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!currentSessionId || !services) return
      Alert.alert(
        t('common.confirm_delete', '确认删除'),
        t('agent.messages.deleteConfirm', '您确定要删除这条消息历史吗？此操作不可逆转。'),
        [
          { text: t('common.cancel', '取消'), style: 'cancel' },
          {
            text: t('common.delete', '删除'),
            style: 'destructive',
            onPress: async () => {
              try {
                await services.sessionRepo.deleteMessageAndFollowing(currentSessionId, messageId)
                await reloadMessagesFromDb(currentSessionId)
              } catch (e) {
                console.error('Failed to delete message', e)
              }
            }
          }
        ]
      )
    },
    [currentSessionId, services, t, reloadMessagesFromDb]
  )

  const updateTokenUsage = useCallback((usage: Partial<TokenUsage>) => {
    setTokenUsage((prev) => ({ ...prev, ...usage }))
  }, [])

  return {
    isStreaming,
    streamingText,
    streamingReasoning,
    tokenUsage,
    activeTool,
    completedTools,
    handleSend,
    handleStop,
    handleRegenerate,
    handleEditMessage,
    handleDeleteMessage,
    updateTokenUsage
  }
}
