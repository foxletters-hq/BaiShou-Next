import { useNavigate } from 'react-router-dom'
import { useDialog, toast } from '@baishou/ui'

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

  /** 重新生成：找到 AI 消息对应的上一条用户消息并重发 */
  const handleRegenerate = (msg: any) => {
    if (msg.role !== 'assistant' || !sessionId) return
    const msgIndex = chat.messages.findIndex((m: any) => m.id === msg.id)
    let userMsgId: string | null = null
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (chat.messages[i].role === 'user') {
        userMsgId = chat.messages[i].id
        break
      }
    }
    if (!userMsgId) return
    const userMsgIndex = chat.messages.findIndex((m: any) => m.id === userMsgId)
    if (userMsgIndex !== -1) {
      chat.setMessages((prev: any[]) => prev.slice(0, userMsgIndex + 1))
    }
    chat.setStreamSessionId(sessionId)
    stream.resendChat(
      sessionId,
      userMsgId,
      searchMode,
      model.currentProviderId,
      model.currentModelId
    )
  }

  /** 保存编辑（不重发）：调用 IPC 更新消息内容后刷新 */
  const handleSaveEdit = async (msg: any, newContent: string) => {
    if (!sessionId || !newContent.trim()) return
    if (typeof window !== 'undefined' && window.electron) {
      await window.electron.ipcRenderer.invoke(
        'agent:edit-message',
        sessionId,
        msg.id,
        newContent,
        model.currentProviderId,
        model.currentModelId,
        undefined,
        searchMode
      )
      await chat.refreshMessages()
    }
  }

  /** 编辑后重发：截断消息列表并重新流式生成 */
  const handleResendEdit = async (msg: any, newContent: string) => {
    if (!sessionId || !newContent.trim()) return
    const msgIndex = chat.messages.findIndex((m: any) => m.id === msg.id)
    if (msgIndex !== -1) chat.setMessages((prev: any[]) => prev.slice(0, msgIndex + 1))
    chat.setStreamSessionId(sessionId)
    await stream.editChat(
      sessionId,
      msg.id,
      newContent,
      model.currentProviderId,
      model.currentModelId,
      undefined,
      searchMode
    )
  }

  /** 重发用户消息（不修改内容） */
  const handleResend = (msg: any) => {
    if (msg.role !== 'user' || !sessionId) return
    const msgIndex = chat.messages.findIndex((m: any) => m.id === msg.id)
    if (msgIndex !== -1) chat.setMessages((prev: any[]) => prev.slice(0, msgIndex + 1))
    chat.setStreamSessionId(sessionId)
    stream.resendChat(sessionId, msg.id, searchMode, model.currentProviderId, model.currentModelId)
  }

  /** 删除消息：二次确认后调用 IPC */
  const handleDelete = async (msg: any) => {
    const ok = await dialog.confirm(
      t('agent.chat.delete_msg_confirm', '您确定要删除这条消息历史吗？此操作不可逆。'),
      t('common.confirm_delete', '确认删除')
    )
    if (!ok) return
    if (typeof window !== 'undefined' && window.electron) {
      window.electron.ipcRenderer
        .invoke('agent:delete-message', sessionId, msg.id)
        .then(() => chat.refreshMessages())
    }
  }

  /** 创建分支会话：复制到当前消息为止的历史，导航到新会话 */
  const handleBranch = async (msg: any) => {
    if (typeof window === 'undefined' || !window.electron) return
    try {
      const currentSession = sessions.find((s) => s.id === sessionId)
      const originalTitle = currentSession?.title || currentAssistant?.name || '对话'
      const title = `${originalTitle} (${t('agent.chat.branch', '分支')})`
      const newSessionId = await window.electron.ipcRenderer.invoke('agent:branch-session', {
        sessionId,
        messageId: msg.id,
        title
      })
      if (newSessionId) {
        toast.showSuccess(t('agent.chat.branch_success', '分支创建成功'))
        if (loadSessions) {
          await loadSessions(true, currentAssistant?.id ? String(currentAssistant.id) : undefined)
        }
        const astId = currentAssistant?.id ? String(currentAssistant.id) : ''
        navigate(`/chat/${newSessionId}${astId ? `?assistantId=${astId}` : ''}`)
      }
    } catch (e: any) {
      toast.showError(e?.message || t('agent.chat.branch_failed', '分支创建失败'))
    }
  }

  /** TTS 朗读 */
  const handleReadAloud = (content: string, msgId: string) => {
    tts.handleTtsReadAloud(content, msgId)
  }

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
