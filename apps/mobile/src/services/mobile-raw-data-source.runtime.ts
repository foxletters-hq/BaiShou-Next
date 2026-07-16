import {
  createRawDataSourceManager,
  MemoryJsonlBackfillService,
  MemorySyncService,
  GraphSyncService,
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
import { EmbeddingAdapter, type IAIProvider } from '@baishou/ai'
import { logger } from '@baishou/shared'

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
  const created = createRawDataSourceManager({
    pathService: options.pathService,
    fs: options.fileSystem
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
