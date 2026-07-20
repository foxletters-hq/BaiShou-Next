import {
  createRawDataSourceManager,
  MemoryJsonlBackfillService,
  MemorySyncService,
  GraphSyncService,
  FsVersionManager,
  bindPendingReextractCollaborators,
  type IVersionManager,
  type RawDataSourceManager,
  type MemoryRawManager,
  type GraphRawManager,
  type DerivedFreshnessService
} from '@baishou/core-desktop'
import {
  connectionManager,
  createSqlExecutorFromDrizzleDb,
  GraphRepository,
  SqliteHybridSearchRepository
} from '@baishou/database-desktop'
import { EmbeddingAdapter } from '@baishou/ai'
import { logger } from '@baishou/shared'
import { fileSystem, getActiveVaultShadowRepo, pathService, vaultService } from '../ipc/vault.ipc'

let runtime: {
  manager: RawDataSourceManager
  memoryManager: MemoryRawManager
  graphManager: GraphRawManager
  freshness: DerivedFreshnessService
  versionManager: IVersionManager
} | null = null

export function getVersionManager(): IVersionManager {
  return ensureRawDataRuntime().versionManager
}

export function getRawDataSourceManager(): RawDataSourceManager {
  return ensureRawDataRuntime().manager
}

export function getMemoryRawManager(): MemoryRawManager {
  return ensureRawDataRuntime().memoryManager
}

export function getGraphRawManager(): GraphRawManager {
  return ensureRawDataRuntime().graphManager
}

export function ensureRawDataRuntime(): {
  manager: RawDataSourceManager
  memoryManager: MemoryRawManager
  graphManager: GraphRawManager
  freshness: DerivedFreshnessService
  versionManager: IVersionManager
} {
  if (!runtime) {
    const versionManager = new FsVersionManager(pathService, fileSystem)
    const created = createRawDataSourceManager({
      pathService,
      fs: fileSystem,
      versionManager
    })
    runtime = {
      manager: created.manager,
      memoryManager: created.memoryManager,
      graphManager: created.graphManager,
      freshness: created.freshness,
      versionManager
    }
    try {
      const shadowRepo = getActiveVaultShadowRepo()
      bindPendingReextractCollaborators({
        freshness: created.freshness,
        graphManager: created.graphManager,
        shadowRepo,
        getVaultName: () => vaultService.getActiveVault()?.name || 'Personal'
      })
    } catch (e) {
      logger.warn('[RawData] bind pending-reextract skipped:', e as Error)
    }
  }
  return runtime
}

export function getDerivedFreshness(): DerivedFreshnessService {
  return ensureRawDataRuntime().freshness
}

/** Re-bind extract collaborators after vault switch (shadow repo changes). */
export function rebindPendingReextractCollaborators(): void {
  const { freshness, graphManager } = ensureRawDataRuntime()
  try {
    const shadowRepo = getActiveVaultShadowRepo()
    bindPendingReextractCollaborators({
      freshness,
      graphManager,
      shadowRepo,
      getVaultName: () => vaultService.getActiveVault()?.name || 'Personal'
    })
  } catch (e) {
    logger.warn('[RawData] rebind pending-reextract failed:', e as Error)
  }
}

/** Call after vault switch so Memory/Graph roots re-resolve. */
export function resetRawDataRuntime(): void {
  runtime?.memoryManager.resetCache()
  runtime?.graphManager.resetCache()
  runtime = null
}

export async function syncMemoryPendingIndex(options: {
  hsRepo: SqliteHybridSearchRepository
  embeddingAdapter?: EmbeddingAdapter | null
}): Promise<{ shards: number; upserted: number; deleted: number }> {
  const { memoryManager } = ensureRawDataRuntime()
  const { hsRepo, embeddingAdapter } = options
  if (!embeddingAdapter?.isConfigured) {
    return { shards: 0, upserted: 0, deleted: 0 }
  }
  const sync = new MemorySyncService(memoryManager, {
    embedText: (opts) => embeddingAdapter.embedText(opts),
    deleteBySource: (sourceType, sourceId) => hsRepo.deleteEmbeddingsBySource(sourceType, sourceId),
    listSourceIdsByType: (sourceType) => hsRepo.listSourceIdsByType(sourceType)
  })
  return sync.syncPendingIndex()
}

export async function backfillMemoryJsonlFromEmbeddings(options: {
  hsRepo: SqliteHybridSearchRepository
  vaultName: string
}): Promise<{ written: number; skipped: number }> {
  const { memoryManager } = ensureRawDataRuntime()
  const service = new MemoryJsonlBackfillService(memoryManager)
  const chatChunks = await options.hsRepo.listEmbeddingChunksByType('chat')
  const memoryChunks = await options.hsRepo.listEmbeddingChunksByType('memory')
  const r1 = await service.backfillFromChunks(chatChunks, options.vaultName)
  const r2 = await service.backfillFromChunks(memoryChunks, options.vaultName)
  return {
    written: r1.written + r2.written,
    skipped: r1.skipped + r2.skipped
  }
}

export async function syncGraphPendingIndexWithDeps(options: {
  graphRepo: GraphRepository
  embeddingAdapter?: EmbeddingAdapter | null
}): Promise<{
  shards: number
  nodesUpserted: number
  edgesUpserted: number
  deleted: number
}> {
  const { graphManager } = ensureRawDataRuntime()
  const sync = new GraphSyncService(graphManager, options.graphRepo, {
    embedQuery: options.embeddingAdapter?.isConfigured
      ? (text) => options.embeddingAdapter!.embedQuery(text)
      : undefined,
    modelId: options.embeddingAdapter?.embeddingModelId
  })
  return sync.syncPendingIndex()
}

/** Tool-context hook: hydrate graph pending-index using current agent DB + embedding. */
export async function syncGraphPendingIndex(): Promise<void> {
  if (!connectionManager.isConnected()) return
  const drizzleDb = connectionManager.getDb()
  const clientExecutor = createSqlExecutorFromDrizzleDb(drizzleDb)
  const hsRepo = new SqliteHybridSearchRepository(clientExecutor)
  const graphRepo = new GraphRepository(drizzleDb)
  let embeddingAdapter: EmbeddingAdapter | null = null
  try {
    const { resolveEmbeddingSystemModels } = await import('../ipc/agent-helpers')
    const { embeddingProvider, embeddingModelId } = await resolveEmbeddingSystemModels()
    if (embeddingProvider && embeddingModelId) {
      embeddingAdapter = new EmbeddingAdapter(embeddingProvider, embeddingModelId, hsRepo)
    }
  } catch {
    // optional
  }
  await syncGraphPendingIndexWithDeps({ graphRepo, embeddingAdapter })
}

/**
 * Cold start / vault switch / sync-complete: backfill Memory JSONL, then pending-index for memory + graph.
 */
export async function runDerivedIndexHydration(reason: string): Promise<void> {
  try {
    if (!connectionManager.isConnected()) {
      logger.warn(`[RawData] skip derived hydration (${reason}): agent db not connected`)
      return
    }
    const activeVault = vaultService.getActiveVault()
    if (!activeVault) {
      logger.warn(`[RawData] skip derived hydration (${reason}): no active vault`)
      return
    }

    const drizzleDb = connectionManager.getDb()
    const clientExecutor = createSqlExecutorFromDrizzleDb(drizzleDb)
    const hsRepo = new SqliteHybridSearchRepository(clientExecutor)
    const graphRepo = new GraphRepository(drizzleDb)

    let embeddingAdapter: EmbeddingAdapter | null = null
    try {
      const { resolveEmbeddingSystemModels } = await import('../ipc/agent-helpers')
      const { embeddingProvider, embeddingModelId } = await resolveEmbeddingSystemModels()
      if (embeddingProvider && embeddingModelId) {
        embeddingAdapter = new EmbeddingAdapter(embeddingProvider, embeddingModelId, hsRepo)
      }
    } catch (e) {
      logger.warn(`[RawData] embedding adapter unavailable (${reason}):`, e as Error)
    }

    const backfill = await backfillMemoryJsonlFromEmbeddings({
      hsRepo,
      vaultName: activeVault.name
    })
    const memory = await syncMemoryPendingIndex({ hsRepo, embeddingAdapter })
    const graph = await syncGraphPendingIndexWithDeps({ graphRepo, embeddingAdapter })

    logger.info(
      `[RawData] derived hydration done (${reason}): backfill=${backfill.written}/${backfill.skipped} memoryShards=${memory.shards} graphShards=${graph.shards}`
    )
  } catch (e) {
    logger.warn(`[RawData] derived hydration failed (${reason}):`, e as Error)
  }
}
