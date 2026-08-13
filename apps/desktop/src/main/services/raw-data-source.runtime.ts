import {
  createRawDataSourceManager,
  MemoryJsonlBackfillService,
  LegacyManualMemoryCopyService,
  MemoryRawManager,
  NotebookRawManager,
  DerivedFreshnessService,
  MemorySyncService,
  GraphSyncService,
  FsVersionManager,
  bindPendingReextractCollaborators,
  type IVersionManager,
  type RawDataSourceManager,
  type GraphRawManager,
  type MemoryConsistencyReport,
  type MemoryConsistencyRepairResult,
  type IStoragePathService
} from '@baishou/core-desktop'
import { VaultScopedStoragePathService } from './vault-scoped-path.service'
import {
  connectionManager,
  createSqlExecutorFromDrizzleDb,
  GraphRepository,
  SqliteHybridSearchRepository
} from '@baishou/database-desktop'
import { EmbeddingAdapter } from '@baishou/ai'
import { logger, MEMORY_EMBED_GROUP_ID } from '@baishou/shared'
import {
  fileSystem,
  getActiveVaultShadowRepo,
  pathService,
  vaultService,
  resolveVaultIdByName
} from '../ipc/vault.ipc'

let runtime: {
  manager: RawDataSourceManager
  memoryManager: MemoryRawManager
  graphManager: GraphRawManager
  notebookManager: NotebookRawManager
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

export function getNotebookRawManager(): NotebookRawManager {
  return ensureRawDataRuntime().notebookManager
}

export function ensureRawDataRuntime(): {
  manager: RawDataSourceManager
  memoryManager: MemoryRawManager
  graphManager: GraphRawManager
  notebookManager: NotebookRawManager
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
      notebookManager: created.notebookManager,
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
  const { freshness } = ensureRawDataRuntime()
  // 冷启动时 vault 可能尚未就绪导致首次 bind 跳过；每次取用时再尝试绑定
  rebindPendingReextractCollaborators()
  return freshness
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
      vaultId: string
      metadataJson?: string
      sourceCreatedAt?: number
    }) => {
      if (!embeddingAdapter?.isConfigured) {
        throw new Error('Embedding adapter not configured')
      }
      await embeddingAdapter.embedText({
        ...opts,
        groupId: MEMORY_EMBED_GROUP_ID,
        vaultId: opts.vaultId
      })
    },
    deleteBySource: (sourceType: string, sourceId: string) =>
      hsRepo.deleteEmbeddingsBySource(sourceType, sourceId),
    listSourceIdsByType: (sourceType: string, options?: { groupId?: string; vaultId?: string }) => {
      if (
        options &&
        typeof options === 'object' &&
        ('groupId' in options || 'vaultId' in options)
      ) {
        return hsRepo.listSourceIdsByType(sourceType, {
          groupId: options.groupId ?? MEMORY_EMBED_GROUP_ID,
          vaultId: options.vaultId
        })
      }
      // legacy string arg: memory:<name> or bare vault name / id
      const legacy = options as unknown as string | undefined
      if (typeof legacy === 'string' && legacy.startsWith('memory:')) {
        const vaultName = legacy.slice('memory:'.length)
        return hsRepo.listSourceIdsByType(sourceType, {
          groupId: MEMORY_EMBED_GROUP_ID,
          vaultId: resolveVaultIdByName(vaultName)
        })
      }
      return hsRepo.listSourceIdsByType(sourceType, {
        groupId: MEMORY_EMBED_GROUP_ID,
        vaultId: typeof legacy === 'string' ? resolveVaultIdByName(legacy) : undefined
      })
    }
  }
}

function createVaultScopedMemoryManager(vaultName: string): MemoryRawManager {
  const scoped: IStoragePathService = new VaultScopedStoragePathService(pathService, vaultName)
  // 独立 freshness，避免覆盖活跃仓库 Memory 在 DerivedFreshnessService 上的注册
  return new MemoryRawManager(scoped, fileSystem, new DerivedFreshnessService())
}

export async function syncMemoryPendingIndex(options: {
  hsRepo: SqliteHybridSearchRepository
  embeddingAdapter?: EmbeddingAdapter | null
  memoryManager?: MemoryRawManager
  vaultId?: string
  vaultName?: string
}): Promise<{ shards: number; upserted: number; deleted: number }> {
  const memoryManager = options.memoryManager ?? ensureRawDataRuntime().memoryManager
  const { hsRepo, embeddingAdapter } = options
  if (!embeddingAdapter?.isConfigured) {
    return { shards: 0, upserted: 0, deleted: 0 }
  }
  const sync = new MemorySyncService(memoryManager, createMemoryEmbedSink(hsRepo, embeddingAdapter))
  return sync.syncPendingIndex({
    vaultId: options.vaultId,
    vaultName: options.vaultName
  })
}

/** V1.6：遗留手动记忆复制到除原件外的各仓库，并排队嵌入。 */
async function copyLegacyManualMemoriesAcrossVaults(options: {
  hsRepo: SqliteHybridSearchRepository
  embeddingAdapter?: EmbeddingAdapter | null
}): Promise<{ originals: number; copied: number; skipped: number }> {
  const vaults = vaultService
    .getAllVaults()
    .map((v) => ({ id: v.id, name: v.name }))
    .filter((v) => v.id && v.name)
  if (vaults.length <= 1) {
    return { originals: 0, copied: 0, skipped: 0 }
  }

  const { memoryManager } = ensureRawDataRuntime()
  const active = vaultService.getActiveVault()
  const service = new LegacyManualMemoryCopyService()

  return service.copyToOtherVaults({
    vaults,
    getManager: (vault) => {
      if (active && vault.id === active.id) return memoryManager
      return createVaultScopedMemoryManager(vault.name)
    },
    afterWrite: async (vault, manager) => {
      if (!options.embeddingAdapter?.isConfigured) return
      await syncMemoryPendingIndex({
        hsRepo: options.hsRepo,
        embeddingAdapter: options.embeddingAdapter,
        memoryManager: manager,
        vaultId: vault.id,
        vaultName: vault.name
      })
    }
  })
}

export async function backfillMemoryJsonlFromEmbeddings(options: {
  hsRepo: SqliteHybridSearchRepository
  vaultId: string
}): Promise<{ written: number; skipped: number; normalized: number; metadataPatched: number }> {
  const { memoryManager } = ensureRawDataRuntime()
  const service = new MemoryJsonlBackfillService(memoryManager)
  const chatChunks = await options.hsRepo.listEmbeddingChunksByType('chat', {
    vaultId: options.vaultId
  })
  const memoryChunks = await options.hsRepo.listEmbeddingChunksByType('memory', {
    vaultId: options.vaultId
  })
  const manualChunks = await options.hsRepo.listEmbeddingChunksByType('manual', {
    vaultId: options.vaultId
  })
  const r1 = await service.backfillFromChunks(chatChunks, options.vaultId)
  const r2 = await service.backfillFromChunks(memoryChunks, options.vaultId)
  const manual = await service.migrateManualAndPatchMetadata(manualChunks, options.vaultId, {
    normalizeManualToMemory: ({ vaultName, sourceIds }) =>
      options.hsRepo.normalizeManualToMemory({ vaultId: vaultName, sourceIds }),
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
    (options.vaultId
      ? vaultService.getAllVaults().find((v) => v.id === options.vaultId)?.name
      : undefined)
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
    (options.vaultId
      ? vaultService.getAllVaults().find((v) => v.id === options.vaultId)?.name
      : undefined)
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
    const legacyCopy = await copyLegacyManualMemoriesAcrossVaults({
      hsRepo,
      embeddingAdapter
    })
    const memory = await syncMemoryPendingIndex({
      hsRepo,
      embeddingAdapter,
      vaultId: activeVault.id,
      vaultName: activeVault.name
    })
    const graph = await syncGraphPendingIndexWithDeps({ graphRepo, embeddingAdapter })

    logger.info(
      `[RawData] derived hydration done (${reason}): backfill=${backfill.written}/${backfill.skipped} normalized=${backfill.normalized} meta=${backfill.metadataPatched} legacyCopy=${legacyCopy.copied}/${legacyCopy.skipped} memoryShards=${memory.shards} graphShards=${graph.shards}`
    )
  } catch (e) {
    logger.warn(`[RawData] derived hydration failed (${reason}):`, e as Error)
  }
}

/** K1.4：同步后 Notebooks/ 差集 → knowledge.db embed jobs */
export async function runKnowledgeHydrationAfterSync(reason: string): Promise<void> {
  try {
    const { knowledgeConnectionManager, KnowledgeRepository } =
      await import('@baishou/database-desktop')
    if (!knowledgeConnectionManager.isConnected()) {
      logger.warn(`[KnowledgeHydration] skip (${reason}): knowledge db not connected`)
      return
    }

    const { KnowledgeHydrationService } = await import('@baishou/core-desktop')
    const { getEmbeddingService } = await import('../ipc/rag.ipc')
    const { resolveActiveVaultId } = await import('../ipc/vault.ipc')
    const embeddingService = getEmbeddingService()
    const repo = new KnowledgeRepository(knowledgeConnectionManager.getDb())
    const notebookManager = getNotebookRawManager()
    const vaultId = resolveActiveVaultId()

    const hydration = new KnowledgeHydrationService({
      repo,
      notebookManager,
      vaultId,
      isEmbeddingConfigured: () => embeddingService.isConfigured
    })
    const result = await hydration.hydrate()

    if (result.embedJobsEnqueued > 0) {
      const { scheduleConsumeKnowledgeIngestJobs } =
        await import('./knowledge-ingest-jobs.consumer')
      scheduleConsumeKnowledgeIngestJobs(reason)
    }

    logger.info(`[KnowledgeHydration] done (${reason})`, { ...result })
  } catch (e) {
    logger.warn(`[KnowledgeHydration] failed (${reason}):`, e as Error)
  }
}
