import i18n from 'i18next'
import { useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  buildBranchSessionTitle,
  extractMessagePlainTextSnippet,
  isConfiguredDialogueModelId,
  isConfiguredProviderId
} from '@baishou/shared'
import { useAgentGateInboxStore } from '@baishou/store'
import { useDialog, toast } from '@baishou/ui'
import { getSessionReasoningEffortOverride } from '../reasoning-effort-session'

interface UseMessageActionsOptions {
  t: any
  sessionId: string | undefined
  chat: any
  stream: any
  model: any
  tts: any
  searchMode: boolean
  currentAssistant: any
  sessions: any[]
  loadSessions?: (reset: boolean, assistantId?: string) => void
}

/**
 * 封装 Agent 聊天界面中所有气泡操作的事件回调。
 * 包含：重新生成、编辑发送、重发、删除消息、创建分支会话。
 */
export function useMessageActions({
  t,
  sessionId,
  chat,
  stream,
  model,
  tts,
  searchMode,
  currentAssistant,
  sessions,
  loadSessions
}: UseMessageActionsOptions) {
  const navigate = useNavigate()
  const dialog = useDialog()
  const retryEpochRef = useRef(0)
  const latestRef = useRef({
    t,
    sessionId,
    chat,
    stream,
    model,
    tts,
    searchMode,
    currentAssistant,
    sessions,
    loadSessions
  })
  latestRef.current = {
    t,
    sessionId,
    chat,
    stream,
    model,
    tts,
    searchMode,
    currentAssistant,
    sessions,
    loadSessions
  }

  const bumpRetryEpoch = () => ++retryEpochRef.current

  const confirmMessageRetry = useCallback(async () => {
    const { t: curT } = latestRef.current
    const t = curT
    return dialog.confirm(
      t(
        'agent.chat.retry_confirm',
        '重新发送将删除此消息之后的对话记录，此操作不可撤销。确定继续吗？'
      ),
      t('agent.chat.retry', '重新发送/生成')
    )
  }, [dialog])

  /** 重新生成：找到 AI 消息对应的上一条用户消息并重发 */
  const handleRegenerate = useCallback(
    async (msg: any) => {
      if (msg.role !== 'assistant' || !latestRef.current.sessionId) return
      const confirmed = await confirmMessageRetry()
      if (!confirmed) return

      const {
        t,
        sessionId: activeSessionId,
        chat: activeChat,
        stream: activeStream,
        model: activeModel,
        searchMode: activeSearchMode
      } = latestRef.current
      if (!activeSessionId) return

      if (
        !isConfiguredProviderId(activeModel.currentProviderId) ||
        !isConfiguredDialogueModelId(activeModel.currentModelId)
      ) {
        toast.showInfo(t('agent.error.no_model', '请先选择一个模型'))
        return
      }

      const msgIndex = activeChat.messages.findIndex((m: any) => m.id === msg.id)
      let userMsgId: string | null = null
      for (let i = msgIndex - 1; i >= 0; i--) {
        if (activeChat.messages[i].role === 'user') {
          userMsgId = activeChat.messages[i].id
          break
        }
      }
      if (!userMsgId) return

      const epoch = bumpRetryEpoch()
      activeChat.truncateMessages(userMsgId)
      activeChat.setStreamSessionId(activeSessionId)
      void activeStream
        .resendChat(
          activeSessionId,
          userMsgId,
          activeSearchMode,
          activeModel.currentProviderId,
          activeModel.currentModelId
        )
        .catch((e: unknown) => {
          if (epoch !== retryEpochRef.current) return
          console.error('[useMessageActions] regenerate failed:', e)
        })
    },
    [confirmMessageRetry]
  )

  /** 保存编辑（不重发）：调用 IPC 更新消息内容后刷新 */
  const handleSaveEdit = useCallback(async (msg: any, newContent: string) => {
    const {
      sessionId: activeSessionId,
      chat: activeChat,
      model: activeModel,
      searchMode: activeSearchMode
    } = latestRef.current
    if (!activeSessionId || !newContent.trim()) return
    if (typeof window !== 'undefined' && window.electron) {
      await window.electron.ipcRenderer.invoke(
        'agent:edit-message',
        activeSessionId,
        msg.id,
        newContent,
        activeModel.currentProviderId,
        activeModel.currentModelId,
        undefined,
        activeSearchMode,
        getSessionReasoningEffortOverride()
      )
      await activeChat.refreshMessages()
    }
  }, [])

  /** 编辑后重发：截断消息列表并重新流式生成 */
  const handleResendEdit = useCallback(async (msg: any, newContent: string) => {
    const {
      t,
      sessionId: activeSessionId,
      chat: activeChat,
      stream: activeStream,
      model: activeModel,
      searchMode: activeSearchMode
    } = latestRef.current
    if (!activeSessionId || !newContent.trim()) return

    if (
      !isConfiguredProviderId(activeModel.currentProviderId) ||
      !isConfiguredDialogueModelId(activeModel.currentModelId)
    ) {
      toast.showInfo(t('agent.error.no_model', '请先选择一个模型'))
      return
    }

    const epoch = bumpRetryEpoch()
    activeChat.truncateMessages(msg.id, { content: newContent })
    activeChat.setStreamSessionId(activeSessionId)
    try {
      await activeStream.editChat(
        activeSessionId,
        msg.id,
        newContent,
        activeModel.currentProviderId,
        activeModel.currentModelId,
        undefined,
        activeSearchMode
      )
    } catch (e) {
      if (epoch !== retryEpochRef.current) return
      console.error('[useMessageActions] resend edit failed:', e)
    }
  }, [])

  /** 重发用户消息（不修改内容） */
  const handleResend = useCallback(
    async (msg: any) => {
      if (msg.role !== 'user' || !latestRef.current.sessionId) return
      const confirmed = await confirmMessageRetry()
      if (!confirmed) return

      const {
        t,
        sessionId: activeSessionId,
        chat: activeChat,
        stream: activeStream,
        model: activeModel,
        searchMode: activeSearchMode
      } = latestRef.current
      if (!activeSessionId) return

      if (
        !isConfiguredProviderId(activeModel.currentProviderId) ||
        !isConfiguredDialogueModelId(activeModel.currentModelId)
      ) {
        toast.showInfo(t('agent.error.no_model', '请先选择一个模型'))
        return
      }

      const epoch = bumpRetryEpoch()
      activeChat.truncateMessages(msg.id)
      activeChat.setStreamSessionId(activeSessionId)
      void activeStream
        .resendChat(
          activeSessionId,
          msg.id,
          activeSearchMode,
          activeModel.currentProviderId,
          activeModel.currentModelId
        )
        .catch((e: unknown) => {
          if (epoch !== retryEpochRef.current) return
          console.error('[useMessageActions] resend failed:', e)
        })
    },
    [confirmMessageRetry]
  )

  /** 删除消息：二次确认后调用 IPC */
  const handleDelete = useCallback(
    async (msg: any) => {
      const { t } = latestRef.current
      const ok = await dialog.confirm(
        t('agent.chat.delete_msg_confirm', '您确定要删除这条消息历史吗？此操作不可逆。'),
        t('common.confirm_delete', '确认删除')
      )
      if (!ok) return
      const { sessionId: activeSessionId, chat: activeChat } = latestRef.current
      if (activeSessionId) {
        useAgentGateInboxStore.getState().clearResolvedLiveForSession(activeSessionId)
      }
      if (typeof window !== 'undefined' && window.electron) {
        window.electron.ipcRenderer
          .invoke('agent:delete-message', activeSessionId, msg.id)
          .then(() => activeChat.refreshMessages())
      }
    },
    [dialog]
  )

  /** 创建分支会话：复制到当前消息为止的历史，导航到新会话 */
  const handleBranch = useCallback(
    async (msg: any) => {
      if (typeof window === 'undefined' || !window.electron) return
      const {
        t,
        sessionId: activeSessionId,
        currentAssistant: activeAssistant,
        sessions: activeSessions,
        loadSessions: activeLoadSessions
      } = latestRef.current
      try {
        const currentSession = activeSessions.find((s) => s.id === activeSessionId)
        const branchPointSnippet =
          extractMessagePlainTextSnippet(msg?.parts) ||
          (typeof msg?.content === 'string' ? msg.content : '')
        const title = buildBranchSessionTitle({
          originalTitle: currentSession?.title,
          assistantName: activeAssistant?.name,
          defaultTitle: i18n.t(
            'auto.apps.desktop.src.renderer.src.features.agent.hooks.useMessageActions.L151',
            '对话'
          ),
          branchLabel: t('agent.chat.branch', '分支'),
          branchPointSnippet
        })
        const newSessionId = await window.electron.ipcRenderer.invoke('agent:branch-session', {
          sessionId: activeSessionId,
          messageId: msg.id,
          title
        })
        if (newSessionId) {
          toast.showSuccess(t('agent.chat.branch_success', '分支创建成功'))
          if (activeLoadSessions) {
            await activeLoadSessions(
              true,
              activeAssistant?.id ? String(activeAssistant.id) : undefined
            )
          }
          const astId = activeAssistant?.id ? String(activeAssistant.id) : ''
          navigate(`/chat/${newSessionId}${astId ? `?assistantId=${astId}` : ''}`)
        }
      } catch (e: any) {
        toast.showError(e?.message || t('agent.chat.branch_failed', '分支创建失败'))
      }
    },
    [navigate]
  )

  /** TTS 朗读 */
  const handleReadAloud = useCallback((content: string, msgId: string) => {
    latestRef.current.tts.handleTtsReadAloud(content, msgId)
  }, [])

  return {
    handleRegenerate,
    handleSaveEdit,
    handleResendEdit,
    handleResend,
    handleDelete,
    handleBranch,
    handleReadAloud
  }
}
