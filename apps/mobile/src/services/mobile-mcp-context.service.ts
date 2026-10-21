import type { AppDatabase } from '@baishou/database'
import type { ToolContext, ToolDiarySearcher, IBaishouAgentGate } from '@baishou/ai'
import {
  AIProviderRegistry,
  DatabaseAdapter,
  EmbeddingAdapter,
  MCP_EXTERNAL_SESSION_ID,
  MemoryDeduplicationServiceImpl,
  createAutoApproveAgentGate,
  syncMcpToolUserConfig
} from '@baishou/ai'
import {
  MessageRepository,
  SqliteHybridSearchRepository,
  createSqlExecutorFromDrizzleDb
} from '@baishou/database'
import type { SettingsManagerService, VaultService } from '@baishou/core-mobile'
import {
  deriveLegacyVaultId,
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  logger
} from '@baishou/shared'
import type { MobileStoragePathService } from './path.service'
import { buildMobileStreamUserConfig } from './mobile-context-at-message.service'

export interface MobileMcpToolContextDeps {
  settingsManager: SettingsManagerService
  pathService: MobileStoragePathService
  vaultService?: VaultService
  getDiarySearcher: () => ToolDiarySearcher | undefined
  getAgentGate?: () => IBaishouAgentGate | undefined
  drizzleDb: unknown
  webSearchResultFetcher: (url: string) => Promise<string>
  fetchSearchPage: (url: string) => Promise<string>
}

/** MCP 外部工具调用上下文：绑定当前活跃工作空间，与应用内 Agent 对齐 */
const MCP_CONTEXT_CACHE_TTL_MS = 5000
let mobileMcpToolContextCache: {
  vaultId: string
  context: ToolContext
  expiresAt: number
} | null = null

export function invalidateMobileMcpToolContextCache(): void {
  mobileMcpToolContextCache = null
}

import type { McpServerConfig } from '@baishou/shared'

export async function buildMobileMcpToolListContext(
  deps: Pick<MobileMcpToolContextDeps, 'settingsManager' | 'pathService' | 'vaultService'>
): Promise<ToolContext> {
  const vaultName = await deps.pathService.getActiveVaultNameForContext().catch(() => 'Personal')
  const vaultId = await resolveMobileActiveVaultId(deps)
  const [userConfig, mcpConfig] = await Promise.all([
    buildMobileStreamUserConfig(deps.settingsManager, true),
    deps.settingsManager.get<McpServerConfig>('mcp_server_config').catch(() => null)
  ])
  const mcpDisabledToolIds = Array.isArray(mcpConfig?.disabledToolIds)
    ? mcpConfig.disabledToolIds
    : []
  return {
    sessionId: MCP_EXTERNAL_SESSION_ID,
    vaultId,
    vaultName,
    userConfig: {
      ...userConfig,
      mcpDisabledToolIds
    }
  }
}

async function resolveMobileActiveVaultId(
  deps: Pick<MobileMcpToolContextDeps, 'pathService' | 'vaultService'>
): Promise<string> {
  try {
    if (deps.vaultService) {
      await deps.vaultService.initRegistry()
      const active = deps.vaultService.getActiveVault()
      if (active?.id) return active.id
    }
  } catch {
    // fallback below
  }
  const vaultName = await deps.pathService.getActiveVaultNameForContext().catch(() => 'Personal')
  return deriveLegacyVaultId(vaultName)
}

export async function buildMobileMcpToolContext(
  deps: MobileMcpToolContextDeps
): Promise<ToolContext> {
  const vaultName = await deps.pathService.getActiveVaultNameForContext().catch(() => 'Personal')
  const vaultId = await resolveMobileActiveVaultId(deps)
  const now = Date.now()

  if (
    mobileMcpToolContextCache &&
    mobileMcpToolContextCache.vaultId === vaultId &&
    mobileMcpToolContextCache.expiresAt > now
  ) {
    return mobileMcpToolContextCache.context
  }

  const [baseUserConfig, mcpConfig] = await Promise.all([
    buildMobileStreamUserConfig(deps.settingsManager, true),
    deps.settingsManager.get<McpServerConfig>('mcp_server_config').catch(() => null)
  ])
  const mcpDisabledToolIds = Array.isArray(mcpConfig?.disabledToolIds)
    ? mcpConfig.disabledToolIds
    : []
  const baseAgentGate = deps.getAgentGate?.()
  const agentGate =
    mcpConfig?.mcpAutoApproveTools === true && baseAgentGate
      ? createAutoApproveAgentGate(baseAgentGate)
      : baseAgentGate
  const userConfig = {
    ...baseUserConfig,
    mcpDisabledToolIds
  }

  const drizzleDb = deps.drizzleDb as AppDatabase | undefined
  if (!drizzleDb) {
    return {
      sessionId: MCP_EXTERNAL_SESSION_ID,
      vaultId,
      vaultName,
      userConfig,
      diarySearcher: deps.getDiarySearcher(),
      webSearchResultFetcher: deps.webSearchResultFetcher,
      fetchSearchPage: deps.fetchSearchPage,
      agentGate
    }
  }

  try {
    const clientExecutor = createSqlExecutorFromDrizzleDb(drizzleDb)
    const hsRepo = new SqliteHybridSearchRepository(clientExecutor)
    const msgRepo = new MessageRepository(drizzleDb)
    const dbAdapter = new DatabaseAdapter(hsRepo, msgRepo, drizzleDb)

    const globalModels = await deps.settingsManager.get<any>('global_models')
    const providers = (await deps.settingsManager.get<any[]>('ai_providers')) || []
    const embeddingProviderId = globalModels?.globalEmbeddingProviderId
    const embeddingModelId = globalModels?.globalEmbeddingModelId

    let embAdapter: EmbeddingAdapter | undefined
    let embeddingProvider: ReturnType<AIProviderRegistry['getOrUpdateProvider']> | undefined

    if (embeddingProviderId && embeddingModelId && embeddingModelId !== 'off') {
      const embConfig = providers.find((p) => p.id === embeddingProviderId)
      if (embConfig) {
        embeddingProvider = AIProviderRegistry.getInstance().getOrUpdateProvider(embConfig)
        embAdapter = new EmbeddingAdapter(embeddingProvider, embeddingModelId, hsRepo)
      }
    }

    let dedupService: MemoryDeduplicationServiceImpl | undefined
    if (embAdapter && isConfiguredProviderId(globalModels?.globalDialogueProviderId)) {
      const dialogueModelId = globalModels?.globalDialogueModelId
      const dialogueConfig = isConfiguredDialogueModelId(dialogueModelId)
        ? providers.find(
            (row) => row.id === globalModels.globalDialogueProviderId && row.isEnabled !== false
          )
        : undefined
      if (dialogueConfig && dialogueModelId) {
        const chatProvider = AIProviderRegistry.getInstance().getOrUpdateProvider(dialogueConfig)
        dedupService = new MemoryDeduplicationServiceImpl(
          embAdapter,
          dbAdapter,
          chatProvider,
          dialogueModelId.trim()
        )
      }
    }

    const context = syncMcpToolUserConfig({
      sessionId: MCP_EXTERNAL_SESSION_ID,
      vaultId,
      vaultName,
      userConfig,
      diarySearcher: deps.getDiarySearcher(),
      embeddingService: embAdapter,
      vectorStore: dbAdapter,
      messageSearcher: dbAdapter,
      summaryReader: dbAdapter,
      deduplicationService: dedupService,
      webSearchResultFetcher: deps.webSearchResultFetcher,
      fetchSearchPage: deps.fetchSearchPage,
      agentGate,
      skillsReader: (await import('./mobile-agent-skills.service')).createMobileSkillsReader(),
      rawDataSourceManager:
        (await import('./mobile-raw-data-source.runtime')).getMobileRawDataSourceManager() ??
        undefined
    })

    mobileMcpToolContextCache = {
      vaultId,
      context,
      expiresAt: now + MCP_CONTEXT_CACHE_TTL_MS
    }

    return context
  } catch (e) {
    logger.warn(
      '[buildMobileMcpToolContext] DB adapters unavailable, using degraded context',
      e as Error
    )
    return {
      sessionId: MCP_EXTERNAL_SESSION_ID,
      vaultId,
      vaultName,
      userConfig,
      diarySearcher: deps.getDiarySearcher(),
      webSearchResultFetcher: deps.webSearchResultFetcher,
      fetchSearchPage: deps.fetchSearchPage,
      agentGate
    }
  }
}
