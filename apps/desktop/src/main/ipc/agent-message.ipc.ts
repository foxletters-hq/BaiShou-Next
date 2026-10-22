import { ipcMain } from 'electron'
import i18n from 'i18next'
import {
  ContextAtMessageService,
  ContextCompressorService,
  reconcileCompressionStateAfterTruncate,
  resolveEffectiveProviderType
} from '@baishou/ai'
import { cleanupAttachmentsForParts } from '@baishou/core-desktop'
import {
  type GlobalModelsConfig,
  isAutoInjectCurrentTimeEnabled,
  resolveDialogueModelSelection,
  resolveWebSearchEnabled,
  sessionBelongsToActiveVaultId,
  logger
} from '@baishou/shared'
import {
  getAgentManagers,
  buildStreamConfig,
  buildAgentUserConfigFromSettings
} from './agent-helpers'
import { AgentChatService } from './AgentChatService'
import { settingsManager } from './settings.ipc'
import { groupPartsByMessageId, mapAgentMessageForRenderer } from './map-agent-message-for-renderer'
import { resolveActiveVaultId } from './vault.ipc'

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
      const { realMessageRepo, realSessionRepo } = getAgentManagers()
      let session = await realSessionRepo.getSessionById(sessionId)
      const activeVaultId = resolveActiveVaultId()
      if (!session) {
        logger.warn(`[IPC] agent:get-messages missing session=${sessionId}`)
        return []
      }
      if (!sessionBelongsToActiveVaultId(session.vaultId, activeVaultId)) {
        // 工作区会话曾写入错误 vault_id（缺省 derive('default')）；有绑定时自愈后放行
        const { getWorkspaceSessionBinding } =
          await import('../services/agent-workspace-session.store')
        const binding = await getWorkspaceSessionBinding(sessionId)
        if (binding && activeVaultId) {
          await realSessionRepo.updateSessionVaultId(sessionId, activeVaultId)
          session = await realSessionRepo.getSessionById(sessionId)
        }
        if (!session || !sessionBelongsToActiveVaultId(session.vaultId, activeVaultId)) {
          logger.warn(
            `[IPC] agent:get-messages denied cross-vault: session=${sessionId} active=${activeVaultId}`
          )
          return []
        }
      }
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
      const session = await realSessionRepo.getSessionById(sessionId)
      const activeVaultId = resolveActiveVaultId()
      if (!session || !sessionBelongsToActiveVaultId(session.vaultId, activeVaultId)) {
        throw new Error(
          i18n.t(
            'auto.apps.desktop.src.main.ipc.agent.session.ipc.cross_vault',
            '无权访问其他工作空间的会话'
          )
        )
      }

      const prefs = await AgentChatService.getAssistantSessionPrefs(sessionId)
      const storedSearchMode = await settingsManager.get<boolean>('search_mode_enabled')
      const webSearchEnabled = resolveWebSearchEnabled(searchMode, storedSearchMode)
      const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
      const resolvedDialogue = resolveDialogueModelSelection({
        requestedProviderId: session?.providerId,
        requestedModelId: session?.modelId,
        globalDialogueProviderId: globalModels?.globalDialogueProviderId,
        globalDialogueModelId: globalModels?.globalDialogueModelId
      })

      const { provider, userConfig } = await buildStreamConfig(
        resolvedDialogue.providerId ?? undefined,
        resolvedDialogue.modelId ?? undefined,
        webSearchEnabled,
        prefs.assistantContextWindow,
        prefs.assistantEmojiPrefs
      )

      const recentCount =
        typeof userConfig?.['recentCount'] === 'number' ? userConfig['recentCount'] : 30

      const { buildAgentSystemPrompt } = await import('./build-agent-system-prompt')
      const systemPrompt = await buildAgentSystemPrompt(sessionId, webSearchEnabled)
      const effectiveModelId = resolvedDialogue.modelId || ''
      const effectiveProviderType = resolveEffectiveProviderType(
        provider?.config?.type || 'openai',
        effectiveModelId
      )

      return ContextAtMessageService.getContextAtMessage(
        sessionId,
        messageId,
        realSessionRepo,
        realSnapshotRepo,
        {
          recentCount,
          modelId: effectiveModelId || undefined,
          providerType: effectiveProviderType,
          systemPrompt,
          wrapMessageTime: isAutoInjectCurrentTimeEnabled(
            Array.isArray(userConfig?.disabledToolIds)
              ? (userConfig.disabledToolIds as string[])
              : undefined
          )
        }
      )
    }
  )

  ipcMain.handle('agent:recompress-context', async (_, sessionId: string) => {
    const { realSessionRepo, realSnapshotRepo } = getAgentManagers()
    const session = await realSessionRepo.getSessionById(sessionId)
    const activeVaultId = resolveActiveVaultId()
    if (!session || !sessionBelongsToActiveVaultId(session.vaultId, activeVaultId)) {
      return { ok: false, error: 'Session not found' }
    }

    const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
    const resolvedDialogue = resolveDialogueModelSelection({
      requestedProviderId: session.providerId,
      requestedModelId: session.modelId,
      globalDialogueProviderId: globalModels?.globalDialogueProviderId,
      globalDialogueModelId: globalModels?.globalDialogueModelId
    })
    if (!resolvedDialogue.providerId || !resolvedDialogue.modelId) {
      return { ok: false, error: 'No model configured for this session' }
    }
    const { provider } = await buildStreamConfig(
      resolvedDialogue.providerId,
      resolvedDialogue.modelId,
      false
    )
    const resolvedModelId = resolvedDialogue.modelId

    const userConfig = await buildAgentUserConfigFromSettings()
    const wrapMessageTime = isAutoInjectCurrentTimeEnabled(
      Array.isArray(userConfig?.disabledToolIds)
        ? (userConfig.disabledToolIds as string[])
        : undefined
    )

    return ContextCompressorService.recompressCurrentSnapshot(
      provider,
      resolvedModelId,
      realSessionRepo,
      realSnapshotRepo,
      sessionId,
      undefined,
      provider.config?.type ?? '',
      { wrapMessageTime }
    )
  })

  // ==========================================
  // API: 删除消息
  // ==========================================
  ipcMain.handle('agent:delete-message', async (_, sessionId: string, messageId: string) => {
    const { realSessionRepo, realSnapshotRepo, sessionManager, attachmentManager } =
      getAgentManagers()
    const session = await realSessionRepo.getSessionById(sessionId)
    const activeVaultId = resolveActiveVaultId()
    if (!session || !sessionBelongsToActiveVaultId(session.vaultId, activeVaultId)) {
      throw new Error(
        i18n.t(
          'auto.apps.desktop.src.main.ipc.agent.session.ipc.cross_vault',
          '无权访问其他工作空间的会话'
        )
      )
    }
    const ids = await realSessionRepo.listMessageIdsFromMessageAndFollowing(sessionId, messageId)
    const parts = ids.length > 0 ? await realSessionRepo.getPartsByMessageIds(ids) : []
    await realSessionRepo.deleteMessageAndFollowing(sessionId, messageId)
    await reconcileCompressionStateAfterTruncate(realSessionRepo, realSnapshotRepo, sessionId)
    await cleanupAttachmentsForParts(attachmentManager, sessionId, parts)
    await sessionManager.flushSessionToDisk(sessionId)
    return true
  })
}
