import { ipcMain } from 'electron'
import {
  ContextAtMessageService,
  ContextCompressorService,
  reconcileCompressionStateAfterTruncate
} from '@baishou/ai'
import { getAgentManagers, buildStreamConfig } from './agent-helpers'
import { AgentChatService } from './AgentChatService'
import { settingsManager } from './settings.ipc'
import {
  groupPartsByMessageId,
  mapAgentMessageForRenderer
} from './map-agent-message-for-renderer'

export function registerMessageIPC() {
  // ==========================================
  // API: 获取消息历史
  // ==========================================
  ipcMain.handle(
    'agent:get-messages',
    async (
      _,
      sessionId: string,
      limit: number = 20,
      offset: number = 0,
      includeParts: boolean = false
    ) => {
      const { realMessageRepo } = getAgentManagers()
      const rows = await realMessageRepo.findBySessionId(sessionId, limit, offset)
      if (rows.length === 0) return []

      const parts = await realMessageRepo.getPartsByMessageIds(rows.map((row) => row.id))
      const partsByMessageId = groupPartsByMessageId(parts)

      return rows.map((msg) =>
        mapAgentMessageForRenderer(msg, partsByMessageId.get(msg.id) ?? [], includeParts)
      )
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
    const { realSessionRepo, realSnapshotRepo } = getAgentManagers()
    await realSessionRepo.deleteMessageAndFollowing(sessionId, messageId)
    await reconcileCompressionStateAfterTruncate(realSessionRepo, realSnapshotRepo, sessionId)
    return true
  })
}
