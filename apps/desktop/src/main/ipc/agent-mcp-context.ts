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
  createAutoApproveAgentGate,
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
import { getDesktopMcpServerConfig } from '../services/desktop-mcp-config.store'

/** MCP 外部工具调用上下文：默认绑定当前活跃工作空间，也支持通过 URL 参数映射指定工作空间 */
const MCP_CONTEXT_CACHE_TTL_MS = 5000
const mcpToolContextCache = new Map<
  string,
  {
    context: ToolContext
    expiresAt: number
  }
>()

export function invalidateMcpToolContextCache(): void {
  mcpToolContextCache.clear()
}

function resolveTargetMcpVault(targetVault?: string): { id: string; name: string } {
  const requested = typeof targetVault === 'string' ? targetVault.trim() : ''
  if (requested) {
    const allVaults =
      typeof vaultService.getAllVaults === 'function' ? vaultService.getAllVaults() : []
    const candidates = [...allVaults]
    const active = vaultService.getActiveVault()
    if (active && !candidates.some((v) => v.id === active.id && v.name === active.name)) {
      candidates.push(active)
    }
    const matched =
      candidates.find((v) => v.id === requested || v.name === requested) ??
      candidates.find(
        (v) =>
          v.id.toLowerCase() === requested.toLowerCase() ||
          v.name.toLowerCase() === requested.toLowerCase()
      )
    if (!matched) {
      throw new Error(`Workspace not found: ${requested}`)
    }
    return {
      id: matched.id || deriveLegacyVaultId(matched.name),
      name: matched.name
    }
  }
  const activeVault = vaultService.getActiveVault()
  const vaultName = activeVault?.name || 'Personal'
  const vaultId = activeVault?.id || deriveLegacyVaultId(vaultName)
  return { id: vaultId, name: vaultName }
}

export async function buildMcpToolContext(targetVault?: string): Promise<ToolContext> {
  const resolvedVault = resolveTargetMcpVault(targetVault)
  const vaultName = resolvedVault.name
  const vaultId = resolvedVault.id
  const now = Date.now()

  const cached = mcpToolContextCache.get(vaultId)
  if (cached && cached.expiresAt > now) {
    return cached.context
  }

  const [userConfig, mcpConfig] = await Promise.all([
    buildAgentUserConfigFromSettings({ searchMode: true }),
    getDesktopMcpServerConfig().catch(() => null)
  ])
  const mcpDisabledToolIds = Array.isArray(mcpConfig?.disabledToolIds)
    ? mcpConfig.disabledToolIds
    : []
  const { embeddingProvider, embeddingModelId } = await resolveEmbeddingSystemModels()

  const drizzleDb = connectionManager.getDb()
  const clientExecutor = createSqlExecutorFromDrizzleDb(drizzleDb)
  const hsRepo = new SqliteHybridSearchRepository(clientExecutor)
  const msgRepo = new MessageRepository(drizzleDb)
  const dbAdapter = new DatabaseAdapter(hsRepo, msgRepo, drizzleDb, () => vaultId)

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

  scopedUserConfig = {
    ...scopedUserConfig,
    mcpDisabledToolIds
  }

  // 外部 MCP 客户端的调用不在应用内弹确认：编辑/写入/删除都直接执行，
  // 只保留 Deny 规则（禁用工具、策略拒绝等）。
  const effectiveAgentGate = createAutoApproveAgentGate(agentGate)
  const rawDataRuntime = await import('../services/raw-data-source.runtime')
  const { createCompanionGraphLookups } = await import('@baishou/ai')
  const { GraphRepository } = await import('@baishou/database-desktop')
  const isDbConnected =
    typeof connectionManager.isConnected === 'function' ? connectionManager.isConnected() : true
  const { graphNodeLookup, graphEdgeLookup } = isDbConnected
    ? createCompanionGraphLookups(async () => {
        const repo = new GraphRepository(connectionManager.getDb())
        return {
          findByNameOrAlias: async (name, nodeType) =>
            (await repo.findNodesByNameOrAlias(vaultId, name, nodeType))[0] ?? null,
          findNodesByNameOrAlias: (name, nodeType) =>
            repo.findNodesByNameOrAlias(vaultId, name, nodeType),
          getNodeById: (id) => repo.getNodeById(id, vaultId),
          getEdgeById: (id) => repo.getEdgeById(id, vaultId)
        }
      })
    : { graphNodeLookup: undefined, graphEdgeLookup: undefined }

  const context = syncMcpToolUserConfig({
    sessionId: MCP_EXTERNAL_SESSION_ID,
    vaultId,
    vaultName,
    userConfig: scopedUserConfig,
    diarySearcher: createDiarySearcher({ vaultId, vaultName }),
    embeddingService: embAdapter,
    vectorStore: dbAdapter,
    messageSearcher: dbAdapter,
    summaryReader: dbAdapter,
    deduplicationService: dedupService,
    webSearchResultFetcher: createWebSearchResultFetcher(),
    fetchSearchPage: createFetchSearchPage(),
    agentGate: effectiveAgentGate,
    skillsReader: (await import('../services/desktop-skills-writer')).createDesktopSkillsReader(
      activeWorkspace?.folderRoot ? { folderRoot: activeWorkspace.folderRoot } : undefined
    ),
    rawDataSourceManager: rawDataRuntime.getRawDataSourceManagerForVault(vaultName),
    syncGraphPendingIndex: () =>
      rawDataRuntime.syncGraphPendingIndex({
        vaultId,
        vaultName
      }),
    deleteGraphRecord: async ({ kind, id }) => {
      if (typeof connectionManager.isConnected === 'function' && !connectionManager.isConnected()) {
        throw new Error('Database not connected')
      }
      const { applyDiaryGraphSurgicalDelete } = await import('@baishou/core-desktop')
      await applyDiaryGraphSurgicalDelete({
        kind,
        id,
        vaultId,
        manager: rawDataRuntime.getGraphRawManagerForVault(vaultName),
        repo: new GraphRepository(connectionManager.getDb())
      })
    },
    graphNodeLookup,
    graphEdgeLookup,
    graphReader: (await import('../services/desktop-graph-reader')).createDesktopGraphReader(
      embAdapter?.isConfigured ? (text) => embAdapter.embedQuery(text) : undefined,
      vaultId
    ),
    knowledgeReader: (
      await import('../services/desktop-knowledge-reader')
    ).createDesktopKnowledgeReader(
      embAdapter?.isConfigured ? (text) => embAdapter.embedQuery(text) : undefined,
      vaultId
    ),
    knowledgeGraphReader: (
      await import('../services/desktop-knowledge-graph-reader')
    ).createDesktopKnowledgeGraphReader(
      embAdapter?.isConfigured ? (text) => embAdapter.embedQuery(text) : undefined,
      vaultId
    )
  })

  if (activeWorkspace) {
    context.workspace = activeWorkspace
  }

  mcpToolContextCache.set(vaultId, {
    context,
    expiresAt: now + MCP_CONTEXT_CACHE_TTL_MS
  })

  return context
}
