import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNativeToast } from '@baishou/ui/native'
import { useAgentStore, type AgentMessagePart } from '@baishou/store'
import { useBaishou } from '../providers/BaishouProvider'
import { buildInsertSessionInput } from '../utils/session-input.util'
import { mapSessionMessageFromDb } from '../utils/map-session-message.util'

// 会话消息接口
interface SessionMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning?: string
  timestamp: Date
  toolInvocations?: any[]
  attachments?: any[]
  parts?: AgentMessagePart[]
  inputTokens?: number
  outputTokens?: number
  costMicros?: number
}

export function useAgentSession() {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const { messages, addMessage, clearSession } = useAgentStore()
  const { services, dbReady } = useBaishou()

  // 会话管理状态
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  // 将数据库消息转换为 UI 消息格式
  const mapDbMessageToUI = useCallback((msg: any): SessionMessage => {
    return mapSessionMessageFromDb(msg) as SessionMessage
  }, [])

  const MESSAGE_PAGE_SIZE = 20

  // 加载会话消息（从末尾取最近 N 条）
  const loadMessages = useCallback(
    async (sessionId: string, limit = MESSAGE_PAGE_SIZE) => {
      if (!dbReady || !services) return
      try {
        clearSession()
        const msgs = await services.sessionManager.getMessagesBySession(sessionId, limit)
        if (msgs && msgs.length > 0) {
          msgs.forEach((msg: any) => addMessage(mapDbMessageToUI(msg)))
          setHasMore(msgs.length >= limit)
        } else {
          setHasMore(false)
        }
      } catch (e) {
        console.error('Failed to load messages', e)
        setHasMore(false)
      }
    },
    [dbReady, services, clearSession, addMessage, mapDbMessageToUI]
  )

  // 加载更多历史消息（扩大 limit 后全量替换，避免重复）
  const handleLoadMore = useCallback(async () => {
    if (!dbReady || !currentSessionId || !services) return
    try {
      const newLimit = messages.length + MESSAGE_PAGE_SIZE
      const msgs = await services.sessionManager.getMessagesBySession(currentSessionId, newLimit)
      clearSession()
      if (msgs && msgs.length > 0) {
        msgs.forEach((msg: any) => addMessage(mapDbMessageToUI(msg)))
        setHasMore(msgs.length >= newLimit)
      } else {
        setHasMore(false)
      }
    } catch (e) {
      console.error('Failed to load more messages', e)
    }
  }, [
    dbReady,
    currentSessionId,
    services,
    messages.length,
    clearSession,
    addMessage,
    mapDbMessageToUI
  ])

  // 选择会话
  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      setCurrentSessionId(sessionId)
      await loadMessages(sessionId)
    },
    [loadMessages]
  )

  // 切换伙伴时加载该伙伴最近会话（对齐桌面端 handleAssistantSwitched）
  const handleAssistantSwitched = useCallback(
    async (assistantId: string, providerId?: string, modelId?: string) => {
      if (!dbReady || !services) return
      try {
        const sessionList = await services.sessionManager.list(100, 0, assistantId)
        if (sessionList.length > 0) {
          const sorted = [...sessionList].sort(
            (a: { updatedAt?: Date | string | null }, b: { updatedAt?: Date | string | null }) =>
              new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
          )
          await handleSelectSession(sorted[0]!.id)
          return
        }

        const newId = Date.now().toString()
        await services.sessionManager.upsertSession(
          buildInsertSessionInput({
            id: newId,
            title: t('agent.sessions.default_title', '新对话'),
            assistantId,
            providerId,
            modelId
          })
        )
        setCurrentSessionId(newId)
        clearSession()
      } catch (e) {
        console.error('Failed to switch assistant session', e)
      }
    },
    [dbReady, services, handleSelectSession, clearSession, t]
  )

  // 创建新会话
  const handleCreateSession = useCallback(
    async (options?: { assistantId?: string; providerId?: string; modelId?: string }) => {
      if (!dbReady || !services) return null
      try {
        const newId = Date.now().toString()
        await services.sessionManager.upsertSession(
          buildInsertSessionInput({
            id: newId,
            title: t('agent.sessions.default_title', '新对话'),
            assistantId: options?.assistantId,
            providerId: options?.providerId,
            modelId: options?.modelId
          })
        )
        setCurrentSessionId(newId)
        clearSession()
        return newId
      } catch (e) {
        console.error('Failed to create session', e)
        const msg = e instanceof Error ? e.message : String(e)
        toast.showError(
          t('agent.error.create_session', '由于系统原因创建会话失败: {{msg}}', { msg })
        )
        return null
      }
    },
    [dbReady, services, t, clearSession, toast]
  )

  // 删除会话
  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      if (!services) return
      try {
        await services.sessionManager.deleteSessions([sessionId])
        if (sessionId === currentSessionId) {
          setCurrentSessionId(null)
          clearSession()
        }
      } catch (e) {
        console.error('Failed to delete session', e)
        toast.showError(t('agent.sessions.delete_session', '删除对话'))
      }
    },
    [services, t, currentSessionId, clearSession]
  )

  // 置顶会话
  const handlePinSession = useCallback(
    async (sessionId: string, isPinned: boolean) => {
      if (!services) return
      try {
        await services.sessionManager.togglePin(sessionId, !isPinned)
      } catch (e) {
        console.error('Failed to pin session', e)
      }
    },
    [services]
  )

  const handleRenameSession = useCallback(
    async (sessionId: string, newTitle: string) => {
      if (!services || !newTitle.trim()) return
      try {
        await services.sessionManager.updateTitle(sessionId, newTitle.trim())
      } catch (e) {
        console.error('Failed to rename session', e)
      }
    },
    [services]
  )

  return {
    // 状态
    currentSessionId,
    setCurrentSessionId,
    hasMore,
    messages,
    // 方法
    loadMessages,
    handleLoadMore,
    handleSelectSession,
    handleAssistantSwitched,
    handleCreateSession,
    handleDeleteSession,
    handlePinSession,
    handleRenameSession
  }
}
