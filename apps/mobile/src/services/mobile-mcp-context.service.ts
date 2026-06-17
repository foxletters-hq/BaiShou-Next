import type { AppDatabase } from '@baishou/database'
import type { ToolContext, ToolDiarySearcher } from '@baishou/ai'
import {
  AIProviderRegistry,
  DatabaseAdapter,
  EmbeddingAdapter,
  MemoryDeduplicationServiceImpl
} from '@baishou/ai'
import {
  MessageRepository,
  SqliteHybridSearchRepository,
  createSqlExecutorFromDrizzleDb
} from '@baishou/database'
import type { SettingsManagerService } from '@baishou/core-mobile'
import type { MobileStoragePathService } from './path.service'
import { buildMobileStreamUserConfig } from './mobile-context-at-message.service'

export interface MobileMcpToolContextDeps {
  settingsManager: SettingsManagerService
  pathService: MobileStoragePathService
  getDiarySearcher: () => ToolDiarySearcher | undefined
  drizzleDb: unknown
  webSearchResultFetcher: (url: string) => Promise<string>
  fetchSearchPage: (url: string) => Promise<string>
}

/** MCP 外部工具调用上下文：绑定当前活跃工作空间，与应用内 Agent 对齐 */
const MCP_CONTEXT_CACHE_TTL_MS = 5000
let mobileMcpToolContextCache: {
  vaultName: string
  context: ToolContext
  expiresAt: number
} | null = null

export function invalidateMobileMcpToolContextCache(): void {
  mobileMcpToolContextCache = null
}

export async function buildMobileMcpToolContext(
  deps: MobileMcpToolContextDeps
): Promise<ToolContext> {
  const vaultName = await deps.pathService.getActiveVaultNameForContext().catch(() => 'Personal')
  const now = Date.now()

  if (
    mobileMcpToolContextCache &&
    mobileMcpToolContextCache.vaultName === vaultName &&
    mobileMcpToolContextCache.expiresAt > now
  ) {
    return mobileMcpToolContextCache.context
  }

  const userConfig = await buildMobileStreamUserConfig(deps.settingsManager, false)

  const drizzleDb = deps.drizzleDb as AppDatabase
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
  if (embAdapter && embeddingProvider && embeddingModelId) {
    dedupService = new MemoryDeduplicationServiceImpl(
      embAdapter,
      dbAdapter,
      embeddingProvider,
      embeddingModelId
    )
  }

  const context: ToolContext = {
    sessionId: 'mcp-external',
    vaultName,
    userConfig,
    diarySearcher: deps.getDiarySearcher(),
    embeddingService: embAdapter,
    vectorStore: dbAdapter,
    messageSearcher: dbAdapter,
    summaryReader: dbAdapter,
    deduplicationService: dedupService,
    webSearchResultFetcher: deps.webSearchResultFetcher,
    fetchSearchPage: deps.fetchSearchPage
  }

  mobileMcpToolContextCache = {
    vaultName,
    context,
    expiresAt: now + MCP_CONTEXT_CACHE_TTL_MS
  }

  return context
}
