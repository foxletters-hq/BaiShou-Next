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
  type DerivedFreshnessService,
  type MemoryConsistencyReport,
  type MemoryConsistencyRepairResult
} from '@baishou/core-desktop'
import {
  connectionManager,
  createSqlExecutorFromDrizzleDb,
  GraphRepository,
  SqliteHybridSearchRepository
} from '@baishou/database-desktop'
import { EmbeddingAdapter } from '@baishou/ai'
import { logger, MEMORY_EMBED_GROUP_ID } from '@baishou/shared'
import { fileSystem, getActiveVaultShadowRepo, pathService, vaultService, resolveVaultIdByName } from '../ipc/vault.ipc'

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

function createMemoryEmbedSink(
  hsRepo: SqliteHybridSearchRepository,
  embeddingAdapter?: EmbeddingAdapter | null
) {
  return {
    embedText: async (opts: {
      text: string
      sourceType: string
      sourceId: string
      groupId: string
      vaultName: string
      metadataJson?: string
      sourceCreatedAt?: number
    }) => {
      if (!embeddingAdapter?.isConfigured) {
        throw new Error('Embedding adapter not configured')
      }
      const vaultId = resolveVaultIdByName(opts.vaultName)
      await embeddingAdapter.embedText({
        ...opts,
        groupId: MEMORY_EMBED_GROUP_ID,
        vaultId
      })
    },
    deleteBySource: (sourceType: string, sourceId: string) =>
      hsRepo.deleteEmbeddingsBySource(sourceType, sourceId),
    listSourceIdsByType: (sourceType: string, groupId?: string) => {
      if (typeof groupId === 'string' && groupId.startsWith('memory:')) {
        const vaultName = groupId.slice('memory:'.length)
        return hsRepo.listSourceIdsByType(sourceType, {
          groupId: MEMORY_EMBED_GROUP_ID,
          vaultId: resolveVaultIdByName(vaultName)
        })
      }
      return hsRepo.listSourceIdsByType(sourceType, {
        groupId: MEMORY_EMBED_GROUP_ID,
        vaultId: groupId ? resolveVaultIdByName(groupId) : undefined
      })
    }
  }
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
  const sync = new MemorySyncService(memoryManager, createMemoryEmbedSink(hsRepo, embeddingAdapter))
  return sync.syncPendingIndex()
}

export async function backfillMemoryJsonlFromEmbeddings(options: {
  hsRepo: SqliteHybridSearchRepository
  vaultId: string
}): Promise<{ written: number; skipped: number; normalized: number; metadataPatched: number }> {
  const { memoryManager } = ensureRawDataRuntime()
  const service = new MemoryJsonlBackfillService(memoryManager)
  const chatChunks = await options.hsRepo.listEmbeddingChunksByType('chat')
  const memoryChunks = await options.hsRepo.listEmbeddingChunksByType('memory')
  const manualChunks = await options.hsRepo.listEmbeddingChunksByType('manual')
  const r1 = await service.backfillFromChunks(chatChunks, options.vaultId)
  const r2 = await service.backfillFromChunks(memoryChunks, options.vaultId)
  const manual = await service.migrateManualAndPatchMetadata(manualChunks, options.vaultId, {
    normalizeManualToMemory: (params) => options.hsRepo.normalizeManualToMemory(params),
    updateMetadataBySource: (sourceType, sourceId, metadataJson) =>
      options.hsRepo.updateMetadataBySource(sourceType, sourceId, metadataJson)
  })
  // Also patch metadata for chat/memory backfilled rows (and any pre-existing JSONL)
  // when migrateManual ran with empty manual set — ensure patch still runs once.
  let metadataPatched = manual.metadataPatched
  if (manualChunks.length === 0) {
    metadataPatched = await service.patchMetadataFromJsonl((sourceType, sourceId, metadataJson) =>
      options.hsRepo.updateMetadataBySource(sourceType, sourceId, metadataJson)
    )
  }
  // Catch any remaining manual rows (e.g. empty chunk text skipped from JSONL write)
  const leftoverNormalized = await options.hsRepo.normalizeManualToMemory({
    vaultId: options.vaultId
  })
  return {
    written: r1.written + r2.written + manual.written,
    skipped: r1.skipped + r2.skipped + manual.skipped,
    normalized: manual.normalized + leftoverNormalized,
    metadataPatched
  }
}

export async function checkMemoryConsistency(options: {
  hsRepo: SqliteHybridSearchRepository
  vaultId?: string
}): Promise<MemoryConsistencyReport> {
  const { memoryManager } = ensureRawDataRuntime()
  const sync = new MemorySyncService(memoryManager, createMemoryEmbedSink(options.hsRepo))
  const activeVault = vaultService.getActiveVault()
  const vaultName =
    activeVault?.name ??
    (options.vaultId ? vaultService.getAllVaults().find((v) => v.id === options.vaultId)?.name : undefined)
  return sync.checkConsistency({ vaultName: vaultName ?? options.vaultId })
}

export async function repairMemoryConsistency(options: {
  hsRepo: SqliteHybridSearchRepository
  embeddingAdapter?: EmbeddingAdapter | null
  vaultId?: string
  confirmDeleteIds?: string[]
  restoreIds?: string[]
  cleanOrphans?: boolean
}): Promise<MemoryConsistencyRepairResult> {
  const { memoryManager } = ensureRawDataRuntime()
  const embeddingAdapter = options.embeddingAdapter
  const sync = new MemorySyncService(
    memoryManager,
    createMemoryEmbedSink(options.hsRepo, embeddingAdapter)
  )
  const activeVault = vaultService.getActiveVault()
  const vaultName =
    activeVault?.name ??
    (options.vaultId ? vaultService.getAllVaults().find((v) => v.id === options.vaultId)?.name : undefined)
  return sync.repairConsistency({
    confirmDeleteIds: options.confirmDeleteIds,
    restoreIds: options.restoreIds,
    cleanOrphans: options.cleanOrphans,
    vaultName: vaultName ?? options.vaultId
  })
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
      vaultId: activeVault.id
    })
    const memory = await syncMemoryPendingIndex({ hsRepo, embeddingAdapter })
    const graph = await syncGraphPendingIndexWithDeps({ graphRepo, embeddingAdapter })

    logger.info(
      `[RawData] derived hydration done (${reason}): backfill=${backfill.written}/${backfill.skipped} normalized=${backfill.normalized} meta=${backfill.metadataPatched} memoryShards=${memory.shards} graphShards=${graph.shards}`
    )
  } catch (e) {
    logger.warn(`[RawData] derived hydration failed (${reason}):`, e as Error)
  }
}
