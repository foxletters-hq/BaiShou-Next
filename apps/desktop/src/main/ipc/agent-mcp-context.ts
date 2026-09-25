import {
  MessageRepository,
  connectionManager,
  SqliteHybridSearchRepository,
  createSqlExecutorFromDrizzleDb
} from '@baishou/database-desktop'
import {
  DatabaseAdapter,
  EmbeddingAdapter,
  MemoryDeduplicationServiceImpl,
  MCP_EXTERNAL_SESSION_ID,
  syncMcpToolUserConfig,
  type ToolContext
} from '@baishou/ai'
import {
  deriveLegacyVaultId,
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  logger,
  type GlobalModelsConfig
} from '@baishou/shared'
import { getAgentGate, getWorkspaceAgentGate } from '../services/agent-gate.service'
import { resolveActiveWorkspaceToolContext } from '../services/agent-workspace-tool-context'
import { resolveOrCreateWorkspaceIdByFolder } from '../services/agent-workspace-registry.store'
import {
  getWorkspaceGateConfig,
  getWorkspacePersonalMemoryRead,
  getWorkspaceToolManagement
} from '../services/agent-workspace-policy.store'
import { vaultService } from './vault.ipc'
import { createDiarySearcher } from './agent-diary-searcher'
import { createFetchSearchPage, createWebSearchResultFetcher } from './agent-web-fetch'
import {
  buildAgentUserConfigFromSettings,
  getActiveProvider,
  resolveEmbeddingSystemModels
} from './agent-stream-config'
import { settingsManager } from './settings.ipc'

/** MCP 外部工具调用上下文：绑定当前活跃工作空间，与应用内 Agent 对齐 */
const MCP_CONTEXT_CACHE_TTL_MS = 5000
let mcpToolContextCache: {
  vaultId: string
  context: ToolContext
  expiresAt: number
} | null = null

export function invalidateMcpToolContextCache(): void {
  mcpToolContextCache = null
}

export async function buildMcpToolContext(): Promise<ToolContext> {
  const activeVault = vaultService.getActiveVault()
  const vaultName = activeVault?.name || 'Personal'
  const vaultId = activeVault?.id || deriveLegacyVaultId(vaultName)
  const now = Date.now()

  if (
    mcpToolContextCache &&
    mcpToolContextCache.vaultId === vaultId &&
    mcpToolContextCache.expiresAt > now
  ) {
    return mcpToolContextCache.context
  }

  const userConfig = await buildAgentUserConfigFromSettings()
  const { embeddingProvider, embeddingModelId } = await resolveEmbeddingSystemModels()

  const drizzleDb = connectionManager.getDb()
  const clientExecutor = createSqlExecutorFromDrizzleDb(drizzleDb)
  const hsRepo = new SqliteHybridSearchRepository(clientExecutor)
  const msgRepo = new MessageRepository(drizzleDb)
  const dbAdapter = new DatabaseAdapter(hsRepo, msgRepo, drizzleDb)

  let embAdapter: EmbeddingAdapter | undefined
  if (embeddingProvider && embeddingModelId) {
    embAdapter = new EmbeddingAdapter(embeddingProvider, embeddingModelId, hsRepo)
  }

  let dedupService: MemoryDeduplicationServiceImpl | undefined
  if (embAdapter) {
    try {
      const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
      const dialogueModelId = globalModels?.globalDialogueModelId
      if (
        isConfiguredProviderId(globalModels?.globalDialogueProviderId) &&
        isConfiguredDialogueModelId(dialogueModelId)
      ) {
        const chatProvider = await getActiveProvider(globalModels?.globalDialogueProviderId)
        dedupService = new MemoryDeduplicationServiceImpl(
          embAdapter,
          dbAdapter,
          chatProvider,
          dialogueModelId!.trim()
        )
      }
    } catch (error) {
      logger.warn('[agent-mcp] dialogue model unavailable, skip memory merge', error as Error)
    }
  }

  const activeWorkspace = await resolveActiveWorkspaceToolContext()
  let agentGate = await getAgentGate()
  let scopedUserConfig = userConfig

  if (activeWorkspace?.folderRoot) {
    const workspaceId = await resolveOrCreateWorkspaceIdByFolder(activeWorkspace.folderRoot)
    const [workspaceGateConfig, workspaceTools, personalMemoryReadEnabled] = await Promise.all([
      getWorkspaceGateConfig(workspaceId),
      getWorkspaceToolManagement(workspaceId),
      getWorkspacePersonalMemoryRead(workspaceId)
    ])
    agentGate = await getWorkspaceAgentGate(workspaceId)
    scopedUserConfig = {
      ...userConfig,
      disabledToolIds: workspaceTools.disabledToolIds,
      baishou_agent_gate_config: workspaceGateConfig,
      workspaceId,
      personalMemoryReadEnabled
    }
  }

  const context = syncMcpToolUserConfig({
    sessionId: MCP_EXTERNAL_SESSION_ID,
    vaultId: activeVault?.id || deriveLegacyVaultId(vaultName),
    vaultName,
    userConfig: scopedUserConfig,
    diarySearcher: createDiarySearcher(),
    embeddingService: embAdapter,
    vectorStore: dbAdapter,
    messageSearcher: dbAdapter,
    summaryReader: dbAdapter,
    deduplicationService: dedupService,
    webSearchResultFetcher: createWebSearchResultFetcher(),
    fetchSearchPage: createFetchSearchPage(),
    agentGate,
    rawDataSourceManager: (
      await import('../services/raw-data-source.runtime')
    ).getRawDataSourceManager(),
    graphReader: (await import('../services/desktop-graph-reader')).createDesktopGraphReader(
      embAdapter?.isConfigured ? (text) => embAdapter.embedQuery(text) : undefined
    ),
    knowledgeReader: (
      await import('../services/desktop-knowledge-reader')
    ).createDesktopKnowledgeReader(
      embAdapter?.isConfigured ? (text) => embAdapter.embedQuery(text) : undefined
    ),
    knowledgeGraphReader: (
      await import('../services/desktop-knowledge-graph-reader')
    ).createDesktopKnowledgeGraphReader()
  })

  if (activeWorkspace) {
    context.workspace = activeWorkspace
  }

  mcpToolContextCache = {
    vaultId,
    context,
    expiresAt: now + MCP_CONTEXT_CACHE_TTL_MS
  }

  return context
}
