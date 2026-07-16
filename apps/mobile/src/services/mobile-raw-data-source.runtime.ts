import {
  createRawDataSourceManager,
  MemoryJsonlBackfillService,
  MemorySyncService,
  GraphSyncService,
  FsVersionManager,
  type RawDataSourceManager,
  type MemoryRawManager,
  type GraphRawManager,
  type IFileSystem,
  type IStoragePathService
} from '@baishou/core-mobile'
import {
  createSqlExecutorFromDrizzleDb,
  GraphRepository,
  SqliteHybridSearchRepository,
  type AppDatabase
} from '@baishou/database'
import { AIProviderRegistry, EmbeddingAdapter, type IAIProvider } from '@baishou/ai'
import { logger } from '@baishou/shared'
import type { SettingsManagerService } from '@baishou/core-mobile'

export async function resolveMobileEmbeddingForHydration(
  settingsManager: SettingsManagerService
): Promise<{ embeddingProvider: IAIProvider | null; embeddingModelId: string | null }> {
  try {
    const globalModels = await settingsManager.get<{
      globalEmbeddingProviderId?: string
      globalEmbeddingModelId?: string
    }>('global_models')
    const providers = (await settingsManager.get<Array<{ id: string }>>('ai_providers')) || []
    const embeddingProviderId = globalModels?.globalEmbeddingProviderId
    const embeddingModelId = globalModels?.globalEmbeddingModelId
    if (!embeddingProviderId || !embeddingModelId || embeddingModelId === 'off') {
      return { embeddingProvider: null, embeddingModelId: null }
    }
    const embConfig = providers.find((p) => p.id === embeddingProviderId)
    if (!embConfig) return { embeddingProvider: null, embeddingModelId: null }
    const embeddingProvider = AIProviderRegistry.getInstance().getOrUpdateProvider(
      embConfig as never
    )
    return { embeddingProvider, embeddingModelId }
  } catch {
    return { embeddingProvider: null, embeddingModelId: null }
  }
}

let runtime: {
  manager: RawDataSourceManager
  memoryManager: MemoryRawManager
  graphManager: GraphRawManager
  pathService: IStoragePathService
} | null = null

export function ensureMobileRawDataRuntime(options: {
  pathService: IStoragePathService
  fileSystem: IFileSystem
}): {
  manager: RawDataSourceManager
  memoryManager: MemoryRawManager
  graphManager: GraphRawManager
} {
  if (runtime && runtime.pathService === options.pathService) {
    return runtime
  }
  const versionManager = new FsVersionManager(options.pathService, options.fileSystem)
  const created = createRawDataSourceManager({
    pathService: options.pathService,
    fs: options.fileSystem,
    versionManager
  })
  runtime = {
    manager: created.manager,
    memoryManager: created.memoryManager,
    graphManager: created.graphManager,
    pathService: options.pathService
  }
  return runtime
}

export function getMobileRawDataSourceManager(): RawDataSourceManager | null {
  return runtime?.manager ?? null
}

export function resetMobileRawDataRuntime(): void {
  runtime?.memoryManager.resetCache()
  runtime?.graphManager.resetCache()
  runtime = null
}

/** Tool hook: only graph pending-index → SQLite. */
export async function syncMobileGraphPendingIndex(options: {
  drizzleDb: AppDatabase
  embeddingProvider?: IAIProvider | null
  embeddingModelId?: string | null
}): Promise<void> {
  if (!runtime) return
  const graphRepo = new GraphRepository(options.drizzleDb)
  let embeddingAdapter: EmbeddingAdapter | null = null
  if (options.embeddingProvider && options.embeddingModelId) {
    embeddingAdapter = new EmbeddingAdapter(
      options.embeddingProvider,
      options.embeddingModelId
    )
  }
  const graphSync = new GraphSyncService(runtime.graphManager, graphRepo, {
    embedQuery: embeddingAdapter?.isConfigured
      ? (text) => embeddingAdapter!.embedQuery(text)
      : undefined,
    modelId: embeddingAdapter?.embeddingModelId
  })
  await graphSync.syncPendingIndex()
}

export async function runMobileDerivedIndexHydration(options: {
  drizzleDb: AppDatabase
  vaultName: string
  embeddingProvider?: IAIProvider | null
  embeddingModelId?: string | null
  reason: string
}): Promise<void> {
  if (!runtime) {
    logger.warn(`[RawData] mobile skip hydration (${options.reason}): runtime not ready`)
    return
  }
  try {
    const clientExecutor = createSqlExecutorFromDrizzleDb(options.drizzleDb)
    const hsRepo = new SqliteHybridSearchRepository(clientExecutor)
    const graphRepo = new GraphRepository(options.drizzleDb)

    let embeddingAdapter: EmbeddingAdapter | null = null
    if (options.embeddingProvider && options.embeddingModelId) {
      embeddingAdapter = new EmbeddingAdapter(
        options.embeddingProvider,
        options.embeddingModelId,
        hsRepo
      )
    }

    const backfill = new MemoryJsonlBackfillService(runtime.memoryManager)
    const chatChunks = await hsRepo.listEmbeddingChunksByType('chat')
    const memoryChunks = await hsRepo.listEmbeddingChunksByType('memory')
    await backfill.backfillFromChunks(chatChunks, options.vaultName)
    await backfill.backfillFromChunks(memoryChunks, options.vaultName)

    if (embeddingAdapter?.isConfigured) {
      const memorySync = new MemorySyncService(runtime.memoryManager, {
        embedText: (opts) => embeddingAdapter!.embedText(opts),
        deleteBySource: (sourceType, sourceId) =>
          hsRepo.deleteEmbeddingsBySource(sourceType, sourceId),
        listSourceIdsByType: (sourceType) => hsRepo.listSourceIdsByType(sourceType)
      })
      await memorySync.syncPendingIndex()
    }

    const graphSync = new GraphSyncService(runtime.graphManager, graphRepo, {
      embedQuery: embeddingAdapter?.isConfigured
        ? (text) => embeddingAdapter!.embedQuery(text)
        : undefined,
      modelId: embeddingAdapter?.embeddingModelId
    })
    await graphSync.syncPendingIndex()

    logger.info(`[RawData] mobile derived hydration done (${options.reason})`)
  } catch (e) {
    logger.warn(`[RawData] mobile derived hydration failed (${options.reason}):`, e as Error)
  }
}
