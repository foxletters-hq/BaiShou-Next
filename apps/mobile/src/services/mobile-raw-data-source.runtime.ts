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
  type RawDataSourceManager,
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
import { logger, MEMORY_EMBED_GROUP_ID, deriveLegacyVaultId } from '@baishou/shared'
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
  notebookManager: NotebookRawManager
  freshness: DerivedFreshnessService
  pathService: IStoragePathService
  fileSystem: IFileSystem
} | null = null

export function ensureMobileRawDataRuntime(options: {
  pathService: IStoragePathService
  fileSystem: IFileSystem
}): {
  manager: RawDataSourceManager
  memoryManager: MemoryRawManager
  graphManager: GraphRawManager
  notebookManager: NotebookRawManager
  freshness: DerivedFreshnessService
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
    notebookManager: created.notebookManager,
    freshness: created.freshness,
    pathService: options.pathService,
    fileSystem: options.fileSystem
  }
  return runtime
}

export function getMobileDerivedFreshness(): DerivedFreshnessService | null {
  return runtime?.freshness ?? null
}

export function getMobileGraphRawManager(): GraphRawManager | null {
  return runtime?.graphManager ?? null
}

export function getMobileRawDataSourceManager(): RawDataSourceManager | null {
  return runtime?.manager ?? null
}

export function getMobileMemoryRawManager(): MemoryRawManager | null {
  return runtime?.memoryManager ?? null
}

export function getMobileNotebookRawManager(): NotebookRawManager | null {
  return runtime?.notebookManager ?? null
}

export function resetMobileRawDataRuntime(): void {
  runtime?.memoryManager.resetCache()
  runtime?.graphManager.resetCache()
  runtime = null
}

function createMobileMemoryEmbedSink(
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
    listSourceIdsByType: (
      sourceType: string,
      options?: { groupId?: string; vaultId?: string }
    ) =>
      hsRepo.listSourceIdsByType(sourceType, {
        groupId: options?.groupId ?? MEMORY_EMBED_GROUP_ID,
        vaultId: options?.vaultId
      })
  }
}

function createVaultScopedMemoryManager(vaultName: string): MemoryRawManager {
  if (!runtime) {
    throw new Error('mobile raw-data runtime not ready')
  }
  const { pathService, fileSystem } = runtime
  const scopedPath = {
    getMemoryBaseDirectory: async () => {
      const vaultDir = await pathService.getVaultDirectory(vaultName)
      return `${vaultDir}/Memory`
    }
  } as unknown as IStoragePathService
  // 独立 freshness，避免覆盖活跃仓库 Memory 注册
  return new MemoryRawManager(scopedPath, fileSystem, new DerivedFreshnessService())
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
    embeddingAdapter = new EmbeddingAdapter(options.embeddingProvider, options.embeddingModelId)
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
  vaultId: string
  vaultName?: string
  /** 全部仓库；缺省则仅活跃仓库（V1.6 复制为空操作） */
  vaults?: Array<{ id: string; name: string }>
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
    const chatChunks = await hsRepo.listEmbeddingChunksByType('chat', { vaultId: options.vaultId })
    const memoryChunks = await hsRepo.listEmbeddingChunksByType('memory', {
      vaultId: options.vaultId
    })
    const manualChunks = await hsRepo.listEmbeddingChunksByType('manual', {
      vaultId: options.vaultId
    })
    const vaultName = options.vaultName ?? options.vaultId
    await backfill.backfillFromChunks(chatChunks, vaultName)
    await backfill.backfillFromChunks(memoryChunks, vaultName)
    await backfill.migrateManualAndPatchMetadata(manualChunks, vaultName, {
      normalizeManualToMemory: (params) =>
        hsRepo.normalizeManualToMemory({
          vaultId: options.vaultId,
          sourceIds: 'sourceIds' in params ? params.sourceIds : undefined
        }),
      updateMetadataBySource: (sourceType, sourceId, metadataJson) =>
        hsRepo.updateMetadataBySource(sourceType, sourceId, metadataJson)
    })
    if (manualChunks.length === 0) {
      await backfill.patchMetadataFromJsonl((sourceType, sourceId, metadataJson) =>
        hsRepo.updateMetadataBySource(sourceType, sourceId, metadataJson)
      )
    }
    await hsRepo.normalizeManualToMemory({ vaultId: options.vaultId })

    // V1.6：遗留手动记忆复制到各仓库
    const vaults =
      options.vaults && options.vaults.length > 0
        ? options.vaults
        : [{ id: options.vaultId, name: vaultName }]
    const activeId = options.vaultId
    const legacyCopy = await new LegacyManualMemoryCopyService().copyToOtherVaults({
      vaults,
      getManager: (vault) => {
        if (vault.id === activeId) return runtime!.memoryManager
        return createVaultScopedMemoryManager(vault.name)
      },
      afterWrite: async (vault, manager) => {
        if (!embeddingAdapter?.isConfigured) return
        const memorySync = new MemorySyncService(
          manager,
          createMobileMemoryEmbedSink(hsRepo, embeddingAdapter)
        )
        await memorySync.syncPendingIndex({ vaultId: vault.id, vaultName: vault.name })
      }
    })

    if (embeddingAdapter?.isConfigured) {
      const memorySync = new MemorySyncService(
        runtime.memoryManager,
        createMobileMemoryEmbedSink(hsRepo, embeddingAdapter)
      )
      await memorySync.syncPendingIndex({
        vaultId: options.vaultId,
        vaultName: options.vaultName
      })
    }

    const graphSync = new GraphSyncService(runtime.graphManager, graphRepo, {
      embedQuery: embeddingAdapter?.isConfigured
        ? (text) => embeddingAdapter!.embedQuery(text)
        : undefined,
      modelId: embeddingAdapter?.embeddingModelId
    })
    await graphSync.syncPendingIndex()

    logger.info(
      `[RawData] mobile derived hydration done (${options.reason}): legacyCopy=${legacyCopy.copied}/${legacyCopy.skipped}`
    )
  } catch (e) {
    logger.warn(`[RawData] mobile derived hydration failed (${options.reason}):`, e as Error)
  }
}

/** K1.4：同步后 Notebooks/ 差集 → knowledge.db embed jobs（消费端本地重嵌） */
export async function runMobileKnowledgeHydration(options: {
  reason: string
  pathService: IStoragePathService
  fileSystem: IFileSystem
  settingsManager: SettingsManagerService
}): Promise<void> {
  try {
    const { expoKnowledgeConnectionManager, KnowledgeRepository } = await import(
      '@baishou/database/expo'
    )
    if (!expoKnowledgeConnectionManager.isConnected()) {
      const root = await options.pathService.getRootDirectory()
      await options.fileSystem.mkdir(root, { recursive: true })
      await expoKnowledgeConnectionManager.connect(root)
    }
    if (!expoKnowledgeConnectionManager.isConnected()) {
      logger.warn(`[KnowledgeHydration] skip (${options.reason}): knowledge db not connected`)
      return
    }

    const { KnowledgeHydrationService } = await import('@baishou/core-mobile')
    const emb = await resolveMobileEmbeddingForHydration(options.settingsManager)
    const embeddingOk = Boolean(emb.embeddingProvider && emb.embeddingModelId)

    ensureMobileRawDataRuntime({
      pathService: options.pathService,
      fileSystem: options.fileSystem
    })
    const notebookManager = getMobileNotebookRawManager()
    if (!notebookManager) {
      logger.warn(`[KnowledgeHydration] skip (${options.reason}): no notebook manager`)
      return
    }

    const repo = new KnowledgeRepository(expoKnowledgeConnectionManager.getDb())
    const vaultId =
      (await options.pathService.getLocalActiveVaultId?.()) ||
      deriveLegacyVaultId(
        (await options.pathService.getActiveVaultNameForContext?.().catch(() => 'Personal')) ||
          'Personal'
      )
    const hydration = new KnowledgeHydrationService({
      repo,
      notebookManager,
      vaultId,
      isEmbeddingConfigured: () => embeddingOk
    })
    const result = await hydration.hydrate()

    if (result.embedJobsEnqueued > 0 && embeddingOk) {
      const { scheduleConsumeMobileKnowledgeIngestJobs } = await import(
        './mobile-knowledge-ingest-jobs.consumer'
      )
      scheduleConsumeMobileKnowledgeIngestJobs(options.reason)
    }

    logger.info(`[KnowledgeHydration] mobile done (${options.reason})`, result)
  } catch (e) {
    logger.warn(`[KnowledgeHydration] mobile failed (${options.reason}):`, e as Error)
  }
}
