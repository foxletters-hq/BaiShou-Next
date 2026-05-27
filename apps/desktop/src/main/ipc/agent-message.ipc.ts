import { ipcMain } from 'electron'
import { getAgentManagers } from './agent-helpers'

export function registerMessageIPC() {
  // ==========================================
  // API: 获取消息历史
  // ==========================================
  ipcMain.handle(
    'agent:get-messages',
    async (_, sessionId: string, limit: number = 20, offset: number = 0) => {
      const { realMessageRepo } = getAgentManagers()
      const rows = await realMessageRepo.findBySessionId(sessionId, limit, offset)

      const mapped: any[] = []
      for (const msg of rows) {
        const parts = await realMessageRepo.getPartsByMessageId(msg.id)

        // 分离 reasoning 和普通 text
        const textParts = parts.filter((p) => p.type === 'text')
        const reasoningParts = textParts.filter((p) => p.data?.isReasoning)
        const normalTextParts = textParts.filter((p) => !p.data?.isReasoning)

        const contentText = normalTextParts.map((p) => p.data?.text || p.data || '').join('\n')

        const reasoningText = reasoningParts.map((p) => p.data?.text || '').join('\n')

        const toolInvocations = parts
          .filter((p: any) => p.type === 'tool')
          .map((p: any) => ({
            state:
              p.data?.status === 'completed' || p.data?.status === 'failed' ? 'result' : 'call',
            toolCallId: p.data?.callId || '',
            toolName: p.data?.name || '',
            args: p.data?.arguments || {},
            result: p.data?.result
          }))

        // 提取附件 parts 为前端 ChatBubble 所需的 attachments 字段
        const attachmentParts = parts.filter((p: any) => p.type === 'attachment')
        const attachments = attachmentParts.map((p: any) => {
          const att = p.data || {}
          const fileName = att.name || att.fileName || 'Attachment'
          const isImage = att.type === 'image' || att.isImage === true
          const isPdf = att.mimeType === 'application/pdf' || String(fileName).endsWith('.pdf')
          const isText = att.isText === true || att.type === 'text' || /\.(txt|md)$/i.test(fileName)
          const rawPath = att.url || att.filePath || ''
          // file:// 被 webSecurity 阻止，转为 local:// 协议（Electron main 已注册）
          const filePath = rawPath.startsWith('file://')
            ? rawPath.replace(/^file:/i, 'local:')
            : rawPath
          return {
            id: p.id,
            fileName,
            filePath,
            isImage,
            isPdf,
            isText
          }
        })

        mapped.push({
          ...msg,
          content: contentText,
          reasoning: reasoningText || undefined,
          toolInvocations: toolInvocations.length > 0 ? toolInvocations : undefined,
          attachments: attachments.length > 0 ? attachments : undefined,
          parts
        } as any)
      }
      return mapped
    }
  )

  // ==========================================
  // API: 删除消息
  // ==========================================
  ipcMain.handle('agent:delete-message', async (_, sessionId: string, messageId: string) => {
    const { realSessionRepo } = getAgentManagers()
    await realSessionRepo.deleteMessageAndFollowing(sessionId, messageId)
    return true
  })
}
