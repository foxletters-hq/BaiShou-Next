import { ipcMain } from 'electron'
import { AgentChatService } from './AgentChatService'
import { AgentChatActionRunner } from './AgentChatActionRunner'

export function registerChatIPC() {
  // ==========================================
  // API: AI对话 (流式流式输出)
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
      }
    ) => {
      return AgentChatService.chat(event, args)
    }
  )

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
