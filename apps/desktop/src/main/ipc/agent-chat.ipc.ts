import { ipcMain } from 'electron'
import { AgentChatService } from './AgentChatService'
import { AgentChatActionRunner } from './AgentChatActionRunner'

export function registerChatIPC() {
  // ==========================================
  // API: AI对话 (流式输出)
  // ==========================================
  ipcMain.handle(
    'agent:chat',
    async (
      event,
      args: {
        sessionId: string
        text: string
        providerId?: string
        modelId?: string
        attachments?: any[]
        searchMode?: boolean
        userMsgId?: string
        reasoningEffort?: string
      }
    ) => {
      const result = await AgentChatService.chat(event, args)
      // 渲染侧仍期望 boolean；abort 视为成功结束（不 drain 已在 service 内处理）
      return result !== false
    }
  )

  // ==========================================
  // API: Session Runtime admit（默认 queue；idle 时 drain）
  // ==========================================
  ipcMain.handle(
    'agent:admit',
    async (
      event,
      args: {
        sessionId: string
        text: string
        delivery?: 'steer' | 'queue'
        userMessageId?: string
        providerId?: string
        modelId?: string
        reasoningEffort?: string
        searchMode?: boolean
        attachments?: unknown[]
      }
    ) => {
      return AgentChatService.admit(event, args)
    }
  )

  ipcMain.handle('agent:list-pending-inputs', async (_event, sessionId: string) => {
    return AgentChatService.listPendingInputs(sessionId)
  })

  // ==========================================
  // API: 重新生成回复
  // ==========================================
  ipcMain.handle(
    'agent:regenerate',
    async (
      event,
      sessionId: string,
      messageId?: string,
      searchMode?: boolean,
      requestedProviderId?: string,
      requestedModelId?: string
    ) => {
      return AgentChatActionRunner.regenerate(
        event,
        sessionId,
        messageId,
        searchMode,
        requestedProviderId,
        requestedModelId
      )
    }
  )

  // ==========================================
  // API: 停止对话流
  // ==========================================
  ipcMain.handle('agent:stop-stream', async (_, sessionId?: string) => {
    return AgentChatService.stopStream(sessionId)
  })

  // ==========================================
  // API: 编辑并重新发送消息
  // ==========================================
  ipcMain.handle(
    'agent:edit-message',
    async (
      event,
      sessionId: string,
      messageId: string,
      newText: string,
      requestedProviderId?: string,
      requestedModelId?: string,
      attachments?: any[],
      searchMode?: boolean
    ) => {
      return AgentChatActionRunner.editMessage(
        event,
        sessionId,
        messageId,
        newText,
        requestedProviderId,
        requestedModelId,
        attachments,
        searchMode
      )
    }
  )

  // ==========================================
  // API: 重发用户消息与后续推理
  // ==========================================
  ipcMain.handle(
    'agent:resend',
    async (
      event,
      sessionId: string,
      messageId: string,
      searchMode?: boolean,
      requestedProviderId?: string,
      requestedModelId?: string
    ) => {
      return AgentChatActionRunner.resend(
        event,
        sessionId,
        messageId,
        searchMode,
        requestedProviderId,
        requestedModelId
      )
    }
  )
}
