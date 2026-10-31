import type { AppDatabase } from '@baishou/database'
import type { ToolContext, ToolDiarySearcher, IBaishouAgentGate } from '@baishou/ai'
import {
  AIProviderRegistry,
  DatabaseAdapter,
  EmbeddingAdapter,
  GraphReaderAdapter,
  KnowledgeGraphReaderAdapter,
  KnowledgeReaderAdapter,
  MCP_EXTERNAL_SESSION_ID,
  MemoryDeduplicationServiceImpl,
  createAutoApproveAgentGate,
  createCompanionGraphLookups,
  syncMcpToolUserConfig
} from '@baishou/ai'
import {
  GraphRepository,
  MessageRepository,
  SqliteHybridSearchRepository,
  createSqlExecutorFromDrizzleDb
} from '@baishou/database'
import {
  GraphRagService,
  applyDiaryGraphSurgicalDelete,
  type IFileSystem,
  type SettingsManagerService,
  type VaultService
} from '@baishou/core-mobile'
import {
  deriveLegacyVaultId,
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  logger
} from '@baishou/shared'
import type { MobileStoragePathService } from './path.service'
import { buildMobileStreamUserConfig } from './mobile-context-at-message.service'
import { pickBareGraphNameHit } from './graph-name-candidates.util'
import { createScopedMobileDiarySearcher } from './mobile-mcp-diary-searcher'

export interface MobileMcpToolContextDeps {
  settingsManager: SettingsManagerService
  pathService: MobileStoragePathService
  fileSystem?: IFileSystem
  vaultService?: VaultService
  getDiarySearcher: () => ToolDiarySearcher | undefined
  getAgentGate?: () => IBaishouAgentGate | undefined
  drizzleDb: unknown
  webSearchResultFetcher: (url: string) => Promise<string>
  fetchSearchPage: (url: string) => Promise<string>
}

/** MCP 外部工具调用上下文：默认绑定当前活跃工作空间，也支持按 URL 参数映射到指定工作空间 */
const MCP_CONTEXT_CACHE_TTL_MS = 5000
const mobileMcpToolContextCache = new Map<
  string,
  {
    context: ToolContext
    expiresAt: number
  }
>()

export function invalidateMobileMcpToolContextCache(): void {
  mobileMcpToolContextCache.clear()
}

import type { McpServerConfig } from '@baishou/shared'

export async function buildMobileMcpToolListContext(
  deps: Pick<MobileMcpToolContextDeps, 'settingsManager' | 'pathService' | 'vaultService'>,
  targetVault?: string
): Promise<ToolContext> {
  const resolved = await resolveMobileTargetVault(deps, targetVault)
  const [userConfig, mcpConfig] = await Promise.all([
    buildMobileStreamUserConfig(deps.settingsManager, true),
    deps.settingsManager.get<McpServerConfig>('mcp_server_config').catch(() => null)
  ])
  const mcpDisabledToolIds = Array.isArray(mcpConfig?.disabledToolIds)
    ? mcpConfig.disabledToolIds
    : []
  return {
    sessionId: MCP_EXTERNAL_SESSION_ID,
    vaultId: resolved.id,
    vaultName: resolved.name,
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

async function resolveMobileTargetVault(
  deps: Pick<MobileMcpToolContextDeps, 'pathService' | 'vaultService'>,
  targetVault?: string
): Promise<{ id: string; name: string; isScoped: boolean }> {
  const requested = typeof targetVault === 'string' ? targetVault.trim() : ''
  if (requested) {
    if (deps.vaultService) {
      await deps.vaultService.initRegistry()
      const allVaults = deps.vaultService.getAllVaults?.() ?? []
      const active = deps.vaultService.getActiveVault()
      const matched =
        allVaults.find((v) => v.id === requested || v.name === requested) ??
        allVaults.find(
          (v) =>
            v.id.toLowerCase() === requested.toLowerCase() ||
            v.name.toLowerCase() === requested.toLowerCase()
        )
      if (!matched) {
        throw new Error(`Workspace not found: ${requested}`)
      }
      const id = matched.id || deriveLegacyVaultId(matched.name)
      const isScoped = Boolean(active?.id ? active.id !== id : active?.name !== matched.name)
      return { id, name: matched.name, isScoped }
    }
    const activeName = await deps.pathService.getActiveVaultNameForContext().catch(() => 'Personal')
    const activeId = deriveLegacyVaultId(activeName)
    if (requested === activeId || requested === activeName) {
      return { id: activeId, name: activeName, isScoped: false }
    }
    throw new Error(`Workspace not found: ${requested}`)
  }

  const vaultName = await deps.pathService.getActiveVaultNameForContext().catch(() => 'Personal')
  const vaultId = await resolveMobileActiveVaultId(deps)
  return { id: vaultId, name: vaultName, isScoped: false }
}

export async function buildMobileMcpToolContext(
  deps: MobileMcpToolContextDeps,
  targetVault?: string
): Promise<ToolContext> {
  const resolved = await resolveMobileTargetVault(deps, targetVault)
  const vaultName = resolved.name
  const vaultId = resolved.id
  const now = Date.now()

  const cached = mobileMcpToolContextCache.get(vaultId)
  if (cached && cached.expiresAt > now) {
    return cached.context
  }

  const [baseUserConfig, mcpConfig] = await Promise.all([
    buildMobileStreamUserConfig(deps.settingsManager, true),
    deps.settingsManager.get<McpServerConfig>('mcp_server_config').catch(() => null)
  ])
  const mcpDisabledToolIds = Array.isArray(mcpConfig?.disabledToolIds)
    ? mcpConfig.disabledToolIds
    : []
  const baseAgentGate = deps.getAgentGate?.()
  // 外部 MCP 客户端调用不在应用内弹确认：写/删除直接执行，仅保留 Deny 规则。
  const agentGate = baseAgentGate ? createAutoApproveAgentGate(baseAgentGate) : baseAgentGate
  const userConfig = {
    ...baseUserConfig,
    mcpDisabledToolIds
  }

  const usePinnedVaultRuntime = Boolean(targetVault?.trim()) || resolved.isScoped
  const scopedPathService =
    usePinnedVaultRuntime && typeof deps.pathService.forVault === 'function'
      ? deps.pathService.forVault(vaultName)
      : deps.pathService
  const diarySearcher = usePinnedVaultRuntime
    ? ((await createScopedMobileDiarySearcher({
        vaultId,
        vaultName,
        scopedPathService,
        fileSystem: deps.fileSystem,
        vaultService: deps.vaultService
      })) ?? deps.getDiarySearcher())
    : deps.getDiarySearcher()

  const drizzleDb = deps.drizzleDb as AppDatabase | undefined
  if (!drizzleDb) {
    return {
      sessionId: MCP_EXTERNAL_SESSION_ID,
      vaultId,
      vaultName,
      userConfig,
      diarySearcher,
      webSearchResultFetcher: deps.webSearchResultFetcher,
      fetchSearchPage: deps.fetchSearchPage,
      agentGate
    }
  }

  try {
    const clientExecutor = createSqlExecutorFromDrizzleDb(drizzleDb)
    const hsRepo = new SqliteHybridSearchRepository(clientExecutor)
    const msgRepo = new MessageRepository(drizzleDb)
    const dbAdapter = new DatabaseAdapter(hsRepo, msgRepo, drizzleDb, () => vaultId)

    const globalModels = await deps.settingsManager.get<any>('global_models')
    const providers = (await deps.settingsManager.get<any[]>('ai_providers')) || []
    const embeddingProviderId = globalModels?.globalEmbeddingProviderId
    const embeddingModelId = globalModels?.globalEmbeddingModelId

    let embAdapter: EmbeddingAdapter | undefined
    let embeddingProvider: ReturnType<AIProviderRegistry['getOrUpdateProvider']> | undefined

    if (embeddingProviderId && embeddingModelId && embeddingModelId !== 'off') {
      const embConfig = providers.find((p) => p.id === embeddingProviderId && p.isEnabled !== false)
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

    const rawDataRuntime = await import('./mobile-raw-data-source.runtime')
    const rawDataSourceManager = usePinnedVaultRuntime
      ? (rawDataRuntime.getMobileRawDataSourceManagerForVault(vaultName, scopedPathService) ??
        rawDataRuntime.getMobileRawDataSourceManager() ??
        undefined)
      : (rawDataRuntime.getMobileRawDataSourceManager() ?? undefined)
    const graphManager = usePinnedVaultRuntime
      ? (rawDataRuntime.getMobileGraphRawManagerForVault(vaultName, scopedPathService) ??
        rawDataRuntime.getMobileGraphRawManager())
      : rawDataRuntime.getMobileGraphRawManager()

    const { graphNodeLookup, graphEdgeLookup } = createCompanionGraphLookups(async () => {
      const repo = new GraphRepository(drizzleDb)
      return {
        findByNameOrAlias: async (name, nodeType) => {
          const hits = await repo.findNodesByNameOrAlias(vaultId, name, nodeType)
          return pickBareGraphNameHit(hits).hit
        },
        findNodesByNameOrAlias: (name, nodeType) =>
          repo.findNodesByNameOrAlias(vaultId, name, nodeType),
        getNodeById: (id) => repo.getNodeById(id, vaultId),
        getEdgeById: (id) => repo.getEdgeById(id, vaultId)
      }
    })

    const graphReader = new GraphReaderAdapter(async (opts) => {
      try {
        const rag = new GraphRagService(new GraphRepository(drizzleDb))
        const embedQuery = embAdapter?.isConfigured
          ? (text: string) => embAdapter!.embedQuery(text)
          : undefined
        const result = await rag.recallRelations({
          vaultId,
          entity: opts.entity,
          mode: opts.mode,
          depth: opts.depth,
          nodeType: opts.nodeType,
          limit: opts.limit,
          embedQuery
        })
        return {
          anchors: result.anchors.map((a) => ({
            id: a.id,
            name: a.name,
            nodeType: a.nodeType,
            summary: a.summary
          })),
          subgraph: result.subgraph.map((e) => ({
            id: e.id,
            fromId: e.fromId,
            toId: e.toId,
            edgeType: e.edgeType,
            sourceRef: e.sourceRef,
            sourceExcerpt: e.sourceExcerpt,
            validFrom: e.validFrom,
            isCurrent: e.isCurrent
          })),
          timeline: result.timeline?.map((e) => ({
            id: e.id,
            fromId: e.fromId,
            toId: e.toId,
            edgeType: e.edgeType,
            sourceRef: e.sourceRef,
            sourceExcerpt: e.sourceExcerpt,
            validFrom: e.validFrom,
            isCurrent: e.isCurrent
          })),
          nodes: result.nodes.map((n) => ({
            id: n.id,
            name: n.name,
            nodeType: n.nodeType,
            summary: n.summary
          })),
          paths: (result.paths ?? []).map((p) => ({
            nodeIds: p.nodeIds,
            nodeNames: p.nodeNames,
            edges: p.edges.map((e) => ({
              id: e.id,
              fromId: e.fromId,
              toId: e.toId,
              edgeType: e.edgeType,
              sourceRef: e.sourceRef,
              sourceExcerpt: e.sourceExcerpt,
              validFrom: e.validFrom
            })),
            edgeDirections: p.edgeDirections
          }))
        }
      } catch (err: any) {
        console.error('[MobileMcp] recallRelations error:', err?.message || err, err?.stack)
        throw err
      }
    })

    const context = syncMcpToolUserConfig({
      sessionId: MCP_EXTERNAL_SESSION_ID,
      vaultId,
      vaultName,
      userConfig,
      diarySearcher,
      embeddingService: embAdapter,
      vectorStore: dbAdapter,
      messageSearcher: dbAdapter,
      summaryReader: dbAdapter,
      deduplicationService: dedupService,
      webSearchResultFetcher: deps.webSearchResultFetcher,
      fetchSearchPage: deps.fetchSearchPage,
      agentGate,
      skillsReader: (await import('./mobile-agent-skills.service')).createMobileSkillsReader(),
      rawDataSourceManager,
      syncGraphPendingIndex: async () => {
        await rawDataRuntime.syncMobileGraphPendingIndex({
          drizzleDb,
          embeddingProvider: embeddingProvider ?? null,
          embeddingModelId: embeddingModelId ?? null,
          vaultId,
          graphManager
        })
      },
      deleteGraphRecord: async ({ kind, id }) => {
        if (!graphManager) {
          throw new Error('Graph raw manager not ready')
        }
        await applyDiaryGraphSurgicalDelete({
          kind,
          id,
          vaultId,
          manager: graphManager,
          repo: new GraphRepository(drizzleDb)
        })
      },
      graphNodeLookup,
      graphEdgeLookup,
      graphReader,
      knowledgeReader: new KnowledgeReaderAdapter(async (opts) => {
        const { mobileSearchKnowledge } = await import('./mobile-knowledge.service')
        return mobileSearchKnowledge({
          query: opts.query,
          notebookIds: opts.notebookIds,
          limit: opts.limit,
          limitPerNotebook: opts.limitPerNotebook
        })
      }),
      knowledgeGraphReader: new KnowledgeGraphReaderAdapter(async (opts) => {
        const { mobileSearchNotebookGraph } = await import('./mobile-knowledge.service')
        return mobileSearchNotebookGraph({
          query: opts.query,
          notebookIds: opts.notebookIds,
          limit: opts.limit
        })
      })
    })

    mobileMcpToolContextCache.set(vaultId, {
      context,
      expiresAt: now + MCP_CONTEXT_CACHE_TTL_MS
    })

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
      diarySearcher,
      webSearchResultFetcher: deps.webSearchResultFetcher,
      fetchSearchPage: deps.fetchSearchPage,
      agentGate
    }
  }
}
