import { ipcMain } from 'electron'
import { ContextAtMessageService, ContextCompressorService } from '@baishou/ai'
import { getAgentManagers, buildStreamConfig } from './agent-helpers'
import { AgentChatService } from './AgentChatService'
import { settingsManager } from './settings.ipc'

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
  // API: 获取某条消息对应的发送给 AI 的完整上下文
  // ==========================================
  ipcMain.handle(
    'agent:get-context-at-message',
    async (_, sessionId: string, messageId: string, searchMode?: boolean) => {
      const { realSessionRepo, realSnapshotRepo } = getAgentManagers()
      const assistantContextWindow = await AgentChatService.getAssistantContextWindow(sessionId)
      const webSearchEnabled =
        searchMode === true ||
        (searchMode !== false &&
          (await settingsManager.get<boolean>('search_mode_enabled')) === true)

      const { userConfig } = await buildStreamConfig(
        undefined,
        undefined,
        webSearchEnabled,
        assistantContextWindow
      )

      const recentCount =
        typeof userConfig?.['recentCount'] === 'number' ? userConfig['recentCount'] : 30

      const session = await realSessionRepo.getSessionById(sessionId)
      const { buildAgentSystemPrompt } = await import('./build-agent-system-prompt')
      const systemPrompt = await buildAgentSystemPrompt(sessionId, webSearchEnabled)

      return ContextAtMessageService.getContextAtMessage(
        sessionId,
        messageId,
        realSessionRepo,
        realSnapshotRepo,
        {
          recentCount,
          modelId: session?.modelId,
          providerType: session?.providerId,
          systemPrompt
        }
      )
    }
  )

  ipcMain.handle('agent:recompress-context', async (_, sessionId: string) => {
    const { realSessionRepo, realSnapshotRepo } = getAgentManagers()
    const session = await realSessionRepo.getSessionById(sessionId)
    if (!session) {
      return { ok: false, error: 'Session not found' }
    }

    const providerId = session.providerId ?? undefined
    const modelId = session.modelId ?? undefined
    const { provider } = await buildStreamConfig(providerId, modelId, false)
    const resolvedModelId =
      modelId || (await settingsManager.get<any>('global_models'))?.globalDialogueModelId

    if (!resolvedModelId) {
      return { ok: false, error: 'No model configured for this session' }
    }

    return ContextCompressorService.recompressCurrentSnapshot(
      provider,
      resolvedModelId,
      realSessionRepo,
      realSnapshotRepo,
      sessionId
    )
  })

  // ==========================================
  // API: 删除消息
  // ==========================================
  ipcMain.handle('agent:delete-message', async (_, sessionId: string, messageId: string) => {
    const { realSessionRepo } = getAgentManagers()
    await realSessionRepo.deleteMessageAndFollowing(sessionId, messageId)
    return true
  })
}
