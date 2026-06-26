import { AIProviderRegistry, EmbeddingAdapter, HybridSearchService } from '@baishou/ai'
import {
  diaryDateToSourceCreatedSeconds,
  EMBEDDING_SOURCE_SORT_MILLIS_SQL,
  EMBEDDING_SOURCE_SORT_ORDER_SQL,
  buildDiaryEmbeddingGroupId,
  buildDiaryEmbeddingSourceId,
  clearRagDiaryEmbedFailure,
  filterUnindexedDiaries,
  formatLocalDate,
  filterDiaryScopedSearchResults,
  hasRagDiaryEmbedFailure,
  isRagMemoryEnabled,
  limitExecute,
  markRagDiaryEmbedFailure,
  resolveMobileBatchEmbedConcurrency,
  sortDiariesByDateAsc,
  timestampToMillis,
  logger,
  type RagConfig
} from '@baishou/shared'
import { SqliteHybridSearchRepository } from '@baishou/database'
import type { SettingsManagerService, DiaryService } from '@baishou/core-mobile'
import {
  MobileRagAbortError,
  mobileRagOperationControl
} from './mobile-rag-operation-control'
import {
  countDiaryEmbeddingsForVault,
  deleteDiaryEmbeddingAliases,
  purgeAllLegacyDiaryEmbeddings,
  purgeLegacyDiaryEmbeddingsForVault
} from './mobile-diary-embedding.util'
import type { MobileRagVaultScope } from './mobile-rag-vault-scope'
import { listVaultDiaryMetas, loadVaultDiariesForEmbedding } from './mobile-rag-vault-diary'
import type { DiaryMeta } from '@baishou/shared'

export { MobileRagAbortError } from './mobile-rag-operation-control'

const HYBRID_SEARCH_TABLE = 'memory_embeddings'
const PREPARE_DIMENSION_MAX_ATTEMPTS = 3

type StoredRagConfig = RagConfig & { totalEmbeddings?: number }

async function countEmbeddingsInDb(deps: MobileRagServiceDeps): Promise<number> {
  const client = deps.rawSqlClient as {
    execute?: (q: { sql: string; args: unknown[] }) => Promise<{ rows: unknown[] }>
  }
  if (!client?.execute) return 0

  const result = await client.execute({
    sql: `SELECT COUNT(*) as count FROM ${HYBRID_SEARCH_TABLE}`,
    args: []
  })
  const row = result.rows?.[0] as Record<string, number> | number[] | undefined
  return Number((row && typeof row === 'object' && !Array.isArray(row) ? row.count : row?.[0]) ?? 0)
}

/** 批量嵌入结束后一次性更新 rag_config（向量总数 + 失败标记），避免多次写入竞态。 */
async function finalizeBatchEmbedRagConfig(
  deps: MobileRagServiceDeps,
  batchFailed: boolean
): Promise<number> {
  const totalCount = await countEmbeddingsInDb(deps)
  const ragConfig = (await deps.settingsManager.get<StoredRagConfig>('rag_config')) || {
    ragEnabled: true,
    ragTopK: 20,
    ragSimilarityThreshold: 0.4
  }

  let nextConfig: StoredRagConfig = { ...ragConfig, totalEmbeddings: totalCount }
  if (batchFailed) {
    nextConfig = markRagDiaryEmbedFailure(nextConfig)
  } else if (hasRagDiaryEmbedFailure(nextConfig)) {
    nextConfig = clearRagDiaryEmbedFailure(nextConfig)
  }

  await deps.settingsManager.set('rag_config', nextConfig)
  return totalCount
}

async function prepareMobileEmbeddingIndex(
  deps: MobileRagServiceDeps,
  adapter: EmbeddingAdapter
): Promise<number> {
  const globalModels =
    (await deps.settingsManager.get<{ globalEmbeddingDimension?: number }>('global_models')) || {}
  let dimension = Number(globalModels.globalEmbeddingDimension || 0)

  if (dimension <= 0) {
    let vector: number[] | null = null
    for (let attempt = 1; attempt <= PREPARE_DIMENSION_MAX_ATTEMPTS; attempt++) {
      vector = await adapter.embedQuery('hi')
      if (vector?.length) break
      if (attempt < PREPARE_DIMENSION_MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
      }
    }
    if (!vector?.length) {
      throw new Error('嵌入 API 未返回有效向量')
    }
    dimension = vector.length
    globalModels.globalEmbeddingDimension = dimension
    await deps.settingsManager.set('global_models', globalModels)
  }

  await deps.hsRepo.initVectorIndex(dimension)
  return dimension
}

export type RagProgressCallback = (progress: {
  current: number
  total: number
  status: string
}) => void

export interface MobileRagServiceDeps {
  settingsManager: SettingsManagerService
  diaryService: DiaryService
  hsRepo: SqliteHybridSearchRepository
  hybridSearchService: HybridSearchService
  registry: AIProviderRegistry
  rawSqlClient: unknown
  vaultScope?: MobileRagVaultScope
}

type RawSqlClient = {
  execute?: (q: { sql: string; args: unknown[] }) => Promise<{ rows: unknown[] }>
}

function defaultVaultScope(): MobileRagVaultScope {
  return {
    resolveActiveVaultName: async () => 'Personal',
    listVaultNames: async () => ['Personal']
  }
}

async function resolveVaultScope(deps: MobileRagServiceDeps): Promise<MobileRagVaultScope> {
  return deps.vaultScope ?? defaultVaultScope()
}

function diaryVaultListFilterSql(vaultGroupId: string): { clause: string; args: string[] } {
  return {
    clause: `(source_type != 'diary' OR group_id = ?)`,
    args: [vaultGroupId]
  }
}

async function resolveEmbeddingAdapter(
  deps: MobileRagServiceDeps
): Promise<EmbeddingAdapter | null> {
  const providers = (await deps.settingsManager.get<any[]>('ai_providers')) || []
  const globalModels = await deps.settingsManager.get<any>('global_models')
  const embeddingProviderId = globalModels?.globalEmbeddingProviderId
  const embeddingModelId = globalModels?.globalEmbeddingModelId

  if (!embeddingProviderId || !embeddingModelId) return null

  const embeddingProviderConfig = providers.find((p: any) => p.id === embeddingProviderId)
  if (!embeddingProviderConfig) return null

  const embeddingProvider = deps.registry.getOrUpdateProvider(embeddingProviderConfig)
  return new EmbeddingAdapter(embeddingProvider, embeddingModelId, deps.hsRepo)
}

export type EmbedDiaryEntryParams = {
  diaryId: number
  content: string
  tags: string[]
  date: Date | string
  updatedAt: Date
  /** @deprecated 请改用 vaultName；保留兼容旧调用 */
  groupId?: string
  vaultName?: string
}

export type EmbedDiaryEntryOptions = {
  adapter?: EmbeddingAdapter
  skipIndexPrep?: boolean
  skipRagEnabledCheck?: boolean
}

async function loadEmbeddedDiaryIndex(
  deps: MobileRagServiceDeps,
  vaultName: string
): Promise<{
  embeddedIds: Set<string>
  embeddedUpdatedAtMap: Map<string, number>
}> {
  const embeddedIds = new Set<string>()
  const embeddedUpdatedAtMap = new Map<string, number>()
  const client = deps.rawSqlClient as {
    execute?: (q: { sql: string; args: unknown[] }) => Promise<{ rows: unknown[] }>
  }
  if (!client?.execute) {
    return { embeddedIds, embeddedUpdatedAtMap }
  }

  const groupId = buildDiaryEmbeddingGroupId(vaultName)
  const result = await client.execute({
    sql: `SELECT source_id as sourceId, metadata_json as metadataJson FROM ${HYBRID_SEARCH_TABLE} WHERE source_type = 'diary' AND group_id = ?`,
    args: [groupId]
  })

  for (const row of (result.rows || []) as Array<{
    sourceId?: string | number
    metadataJson?: string
  }>) {
    if (row.sourceId == null) continue
    const sourceId = String(row.sourceId)
    embeddedIds.add(sourceId)
    if (!row.metadataJson) continue
    try {
      const meta = JSON.parse(row.metadataJson) as { updated_at?: number }
      if (typeof meta.updated_at === 'number') {
        const currentMax = embeddedUpdatedAtMap.get(sourceId) ?? 0
        if (meta.updated_at > currentMax) {
          embeddedUpdatedAtMap.set(sourceId, meta.updated_at)
        }
      }
    } catch {
      /* ignore malformed metadata */
    }
  }

  return { embeddedIds, embeddedUpdatedAtMap }
}

export async function embedDiaryEntry(
  deps: MobileRagServiceDeps,
  params: EmbedDiaryEntryParams,
  options?: EmbedDiaryEntryOptions
): Promise<void> {
  if (!options?.skipRagEnabledCheck) {
    const ragConfig = (await deps.settingsManager.get<{ ragEnabled?: boolean }>('rag_config')) || {}
    if (!isRagMemoryEnabled({ ragEnabled: ragConfig.ragEnabled ?? true })) return
  }

  const adapter = options?.adapter ?? (await resolveEmbeddingAdapter(deps))
  if (!adapter) return

  if (!options?.skipIndexPrep) {
    await prepareMobileEmbeddingIndex(deps, adapter)
  }

  const scope = await resolveVaultScope(deps)
  const resolvedVault = params.vaultName?.trim() || (await scope.resolveActiveVaultName())
  const sourceId = buildDiaryEmbeddingSourceId(resolvedVault, params.diaryId)
  const groupId = buildDiaryEmbeddingGroupId(resolvedVault)
  await deleteDiaryEmbeddingAliases(deps.hsRepo, resolvedVault, params.diaryId)

  const d = params.date instanceof Date ? params.date : new Date(params.date)
  const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const tagPrefix = params.tags.length > 0 ? `[标签: ${params.tags.join(', ')}] ` : ''
  const prefixedText = `${tagPrefix}[${label} 日记:]\n${params.content}`
  const metadataJson = JSON.stringify({ updated_at: params.updatedAt.getTime() })
  const embedArgs = {
    text: prefixedText,
    sourceType: 'diary',
    sourceId,
    groupId,
    sourceCreatedAt: diaryDateToSourceCreatedSeconds(d) * 1000,
    metadataJson,
    requireSuccess: true as const
  }

  try {
    await adapter.embedText(embedArgs)
  } catch (error) {
    await deps.hsRepo.deleteEmbeddingsBySource('diary', sourceId)
    throw error
  }
}

export type ControlledDiaryBatchEmbedResult = {
  embedded: number
  failed: number
  total: number
  skipped: boolean
  skipReason?: string
}

export async function runControlledDiaryBatchEmbed(
  deps: MobileRagServiceDeps,
  options?: {
    onProgress?: RagProgressCallback
    /** @deprecated 请改用 vaultName */
    groupId?: string
    vaultName?: string
  }
): Promise<ControlledDiaryBatchEmbedResult> {
  mobileRagOperationControl.reset()
  const ragConfig = (await deps.settingsManager.get<{ ragEnabled?: boolean }>('rag_config')) || {}
  if (!isRagMemoryEnabled({ ragEnabled: ragConfig.ragEnabled ?? true })) {
    return { embedded: 0, failed: 0, total: 0, skipped: true, skipReason: 'rag-disabled' }
  }

  const adapter = await resolveEmbeddingAdapter(deps)
  if (!adapter) {
    return { embedded: 0, failed: 0, total: 0, skipped: true, skipReason: 'embedding-not-configured' }
  }

  try {
    await prepareMobileEmbeddingIndex(deps, adapter)
  } catch (error) {
    logger.error('[MobileRag] prepare embedding index failed', { error })
    await finalizeBatchEmbedRagConfig(deps, true)
    return { embedded: 0, failed: 0, total: 0, skipped: true, skipReason: 'prepare-failed' }
  }

  const purgedLegacy = await purgeAllLegacyDiaryEmbeddings(
    deps.rawSqlClient as RawSqlClient | undefined
  )
  if (purgedLegacy > 0) {
    logger.info('[MobileRag] purged legacy diary vectors', { count: purgedLegacy })
  }

  const vaultScope = await resolveVaultScope(deps)
  const shadowDb = vaultScope.getShadowDb?.() ?? null
  const vaultNames = options?.vaultName?.trim()
    ? [options.vaultName.trim()]
    : await vaultScope.listVaultNames()
  const activeVaultName = await vaultScope.resolveActiveVaultName()

  type VaultEmbedPlan = {
    vaultName: string
    diariesToEmbed: DiaryMeta[]
    allDiaryIds: number[]
  }

  const vaultPlans: VaultEmbedPlan[] = []
  let globalTotal = 0

  for (const vaultName of vaultNames) {
    const allDiaries = sortDiariesByDateAsc(
      shadowDb
        ? await listVaultDiaryMetas(shadowDb, vaultName)
        : vaultName === activeVaultName
          ? await deps.diaryService.listAll({ limit: 10000 })
          : []
    )
    const { embeddedIds, embeddedUpdatedAtMap } = await loadEmbeddedDiaryIndex(deps, vaultName)
    const resolveSourceId = (meta: { id: unknown }) =>
      buildDiaryEmbeddingSourceId(vaultName, meta.id as number)
    const diariesToEmbed = filterUnindexedDiaries(allDiaries, embeddedIds, embeddedUpdatedAtMap, {
      resolveSourceId
    })
    if (diariesToEmbed.length === 0) continue
    vaultPlans.push({
      vaultName,
      diariesToEmbed,
      allDiaryIds: allDiaries.map((d) => d.id)
    })
    globalTotal += diariesToEmbed.length
  }

  if (globalTotal === 0) {
    await finalizeBatchEmbedRagConfig(deps, false)
    return { embedded: 0, failed: 0, total: 0, skipped: true, skipReason: 'nothing-to-embed' }
  }

  const ragSettings =
    (await deps.settingsManager.get<{ batchEmbedConcurrency?: number }>('rag_config')) || {}
  const batchConcurrency = resolveMobileBatchEmbedConcurrency(ragSettings.batchEmbedConcurrency)

  const progress = { embedded: 0, failed: 0, completed: 0 }

  const reportProgress = (status: string) => {
    options?.onProgress?.({
      current: progress.completed,
      total: globalTotal,
      status
    })
  }

  for (const plan of vaultPlans) {
    const { vaultName, diariesToEmbed, allDiaryIds } = plan
    await purgeLegacyDiaryEmbeddingsForVault(
      deps.rawSqlClient as RawSqlClient | undefined,
      vaultName,
      allDiaryIds
    )

    const diaryById = shadowDb
      ? await loadVaultDiariesForEmbedding(
          shadowDb,
          vaultName,
          diariesToEmbed.map((meta) => meta.id)
        )
      : await deps.diaryService.findByIdsForEmbedding(diariesToEmbed.map((meta) => meta.id))

    await limitExecute(diariesToEmbed, batchConcurrency, async (meta) => {
      if (mobileRagOperationControl.isAborted) {
        return
      }

      const dateLabel = meta.date
        ? formatLocalDate(meta.date instanceof Date ? meta.date : new Date(meta.date))
        : ''

      try {
        reportProgress(
          `[${vaultName}] 处理日记: ${dateLabel}（${progress.completed}/${globalTotal}）`
        )

        if (mobileRagOperationControl.isAborted) {
          return
        }

        const diary = diaryById.get(meta.id)
        const content = diary && 'content' in diary ? diary.content : undefined
        if (!diary || !content?.trim()) {
          return
        }

        const d =
          diary.date instanceof Date ? diary.date : new Date(String(diary.date ?? meta.date))
        await deleteDiaryEmbeddingAliases(deps.hsRepo, vaultName, meta.id)
        await embedDiaryEntry(
          deps,
          {
            diaryId: meta.id,
            content,
            tags: meta.tags ?? [],
            date: d,
            updatedAt:
              ('updatedAt' in diary && diary.updatedAt instanceof Date
                ? diary.updatedAt
                : meta.updatedAt) ?? new Date(),
            vaultName
          },
          { adapter, skipIndexPrep: true, skipRagEnabledCheck: true }
        )

        progress.embedded++
      } catch (error) {
        if (mobileRagOperationControl.isAborted) {
          return
        }
        progress.failed++
        logger.warn('[MobileRag] diary embed failed', {
          vaultName,
          diaryId: meta.id,
          date: dateLabel,
          error
        })
      } finally {
        progress.completed++
        reportProgress(
          `[${vaultName}] 已嵌入 ${progress.embedded}/${globalTotal}${progress.failed > 0 ? `（失败 ${progress.failed}）` : ''}（${dateLabel}）`
        )
      }
    })
  }

  await finalizeBatchEmbedRagConfig(deps, progress.failed > 0)

  if (mobileRagOperationControl.isAborted) {
    logger.info('[MobileRag] controlled batch embed aborted', {
      embedded: progress.embedded,
      failed: progress.failed,
      total: globalTotal
    })
    throw new MobileRagAbortError(progress.embedded)
  }

  logger.info('[MobileRag] controlled batch embed finished', {
    embedded: progress.embedded,
    failed: progress.failed,
    total: globalTotal,
    vaultCount: vaultPlans.length
  })
  return {
    embedded: progress.embedded,
    failed: progress.failed,
    total: globalTotal,
    skipped: false
  }
}

export function createMobileRagService(deps: MobileRagServiceDeps) {
  const service = {
    async getStats(): Promise<{
      totalCount: number
      currentDimension: number
      diaryCountForVault: number
      activeVaultName: string
    }> {
      const vaultScope = await resolveVaultScope(deps)
      const activeVaultName = await vaultScope.resolveActiveVaultName()
      const globalModels = (await deps.settingsManager.get<any>('global_models')) || {}
      const rawClient = deps.rawSqlClient as RawSqlClient | undefined
      let totalCount = 0
      try {
        if (rawClient?.execute) {
          const result = await rawClient.execute({
            sql: `SELECT COUNT(*) as count FROM ${HYBRID_SEARCH_TABLE}`,
            args: []
          })
          const row = result.rows?.[0] as Record<string, number> | number[] | undefined
          totalCount = Number(
            (row && typeof row === 'object' && !Array.isArray(row) ? row.count : row?.[0]) ?? 0
          )
        }
      } catch (e) {
        logger.warn('[MobileRag] count embeddings failed', e as Error)
        const ragConfig = (await deps.settingsManager.get<any>('rag_config')) || {}
        totalCount = ragConfig.totalEmbeddings || 0
      }

      const diaryCountForVault = await countDiaryEmbeddingsForVault(rawClient, activeVaultName)

      let currentDimension = globalModels.globalEmbeddingDimension || 0
      try {
        const meta = await deps.hsRepo.getCurrentEmbeddingMeta()
        if (meta?.dimension) {
          currentDimension = meta.dimension
        }
      } catch (e) {
        logger.warn('[MobileRag] getCurrentEmbeddingMeta failed', e as Error)
      }

      return { totalCount, currentDimension, diaryCountForVault, activeVaultName }
    },

    async hasModelMismatch(): Promise<boolean> {
      const globalModels = (await deps.settingsManager.get<any>('global_models')) || {}
      const currentModelId = globalModels?.globalEmbeddingModelId as string | undefined
      if (!currentModelId) return false

      try {
        const meta = await deps.hsRepo.getCurrentEmbeddingMeta()
        if (!meta || meta.count === 0) return false

        const heterogeneous = await deps.hsRepo.countHeterogeneousEmbeddings(currentModelId)
        if (heterogeneous > 0) return true

        if (meta.modelId && meta.modelId !== currentModelId) return true

        const configuredDim = Number(globalModels.globalEmbeddingDimension || 0)
        if (configuredDim > 0 && meta.dimension > 0 && configuredDim !== meta.dimension) {
          return true
        }
      } catch (e) {
        logger.warn('[MobileRag] hasModelMismatch failed', e as Error)
      }

      return false
    },

    async reembedAll(onProgress?: RagProgressCallback): Promise<number> {
      mobileRagOperationControl.reset()
      await deps.hsRepo.clearEmbeddings()

      if (mobileRagOperationControl.isAborted) {
        throw new MobileRagAbortError(0)
      }

      const globalModels = (await deps.settingsManager.get<any>('global_models')) || {}
      globalModels.globalEmbeddingDimension = 0
      await deps.settingsManager.set('global_models', globalModels)

      const ragConfig = (await deps.settingsManager.get<any>('rag_config')) || {}
      ragConfig.totalEmbeddings = 0
      await deps.settingsManager.set('rag_config', ragConfig)

      onProgress?.({ current: 0, total: 1, status: 'detect-dimension' })
      if (mobileRagOperationControl.isAborted) {
        throw new MobileRagAbortError(0)
      }

      await service.detectDimension()

      if (mobileRagOperationControl.isAborted) {
        throw new MobileRagAbortError(0)
      }

      return service.batchEmbed(onProgress)
    },

    requestOperationAbort(): void {
      mobileRagOperationControl.requestAbort()
    },

    async detectDimension(): Promise<number> {
      const adapter = await resolveEmbeddingAdapter(deps)
      if (!adapter) {
        throw new Error('嵌入模型未配置')
      }

      const vector = await adapter.embedQuery('hi')
      if (!vector?.length) {
        throw new Error('嵌入 API 未返回有效向量')
      }

      const dimension = vector.length
      const globalModels = (await deps.settingsManager.get<any>('global_models')) || {}
      globalModels.globalEmbeddingDimension = dimension
      await deps.settingsManager.set('global_models', globalModels)

      try {
        await deps.hsRepo.initVectorIndex(dimension)
      } catch (e) {
        logger.warn('[MobileRag] initVectorIndex failed', e as Error)
      }

      return dimension
    },

    async batchEmbed(onProgress?: RagProgressCallback): Promise<number> {
      const result = await runControlledDiaryBatchEmbed(deps, {
        onProgress,
        groupId: 'diary_batch'
      })
      if (result.skipped && result.skipReason === 'embedding-not-configured') {
        throw new Error('嵌入模型未配置')
      }
      if (result.skipped && result.skipReason === 'prepare-failed') {
        throw new Error('嵌入 API 未返回有效向量，请检查模型配置与网络')
      }
      if (result.failed > 0) {
        throw new Error(
          `成功嵌入 ${result.embedded} 篇，${result.failed} 篇失败（共 ${result.total} 篇待处理）`
        )
      }

      return result.embedded
    },

    async queryEntries(params: {
      keyword?: string
      limit?: number
      offset?: number
      mode?: 'semantic' | 'text'
      withTotal?: boolean
      minSimilarity?: number
      sourceType?: string
    }): Promise<{ entries: Array<Record<string, unknown>>; total: number }> {
      const limit = params.limit ?? 10
      const offset = params.offset ?? 0
      const vaultScope = await resolveVaultScope(deps)
      const activeVaultName = await vaultScope.resolveActiveVaultName()
      const vaultGroupId = buildDiaryEmbeddingGroupId(activeVaultName)
      const scopeFilter = diaryVaultListFilterSql(vaultGroupId)

      if (params.mode === 'semantic' && params.keyword?.trim()) {
        const adapter = await resolveEmbeddingAdapter(deps)
        if (adapter) {
          const vector = await adapter.embedQuery(params.keyword)
          if (vector?.length) {
            const baseLimit = Math.max(limit, 50)
            const fetchLimit =
              params.minSimilarity != null ? Math.min(baseLimit * 4, 500) : baseLimit
            const results = filterDiaryScopedSearchResults(
              await deps.hsRepo.queryNativeVector(
                vector,
                fetchLimit,
                params.minSimilarity,
                params.sourceType
              ),
              activeVaultName
            )
            const entries = results.map((r) => ({
              embeddingId: r.messageId,
              text: r.chunkText,
              createdAt: timestampToMillis(r.createdAt) ?? Date.now(),
              sourceType: r.sourceType,
              sourceId: r.sourceId,
              similarity: r.score
            }))
            const sliced = entries.slice(offset, offset + limit)
            return { entries: sliced, total: entries.length }
          }
        }
        return { entries: [], total: 0 }
      }

      const keyword = params.keyword?.trim()
      if (keyword) {
        const fts = filterDiaryScopedSearchResults(
          await deps.hsRepo.queryFTS(keyword, limit + offset),
          activeVaultName
        )
        const page = fts.slice(offset, offset + limit).map((r) => ({
          embeddingId: r.messageId,
          text: r.chunkText,
          createdAt: timestampToMillis(r.createdAt) ?? Date.now(),
          sourceType: r.sourceType,
          sourceId: r.sourceId
        }))
        return { entries: page, total: fts.length }
      }

      const client = deps.rawSqlClient as RawSqlClient | undefined
      if (!client?.execute) return { entries: [], total: 0 }

      const countRes = await client.execute({
        sql: `SELECT COUNT(*) as count FROM ${HYBRID_SEARCH_TABLE} WHERE ${scopeFilter.clause}`,
        args: [...scopeFilter.args]
      })
      const countRow = countRes.rows?.[0] as Record<string, number> | undefined
      const total = Number(countRow?.count ?? 0)

      const listRes = await client.execute({
        sql: `SELECT embedding_id as embeddingId, chunk_text as text, source_type as sourceType,
              ${EMBEDDING_SOURCE_SORT_MILLIS_SQL} as createdAt
              FROM ${HYBRID_SEARCH_TABLE}
              WHERE ${scopeFilter.clause}
              ORDER BY ${EMBEDDING_SOURCE_SORT_ORDER_SQL}
              LIMIT ? OFFSET ?`,
        args: [...scopeFilter.args, limit, offset]
      })
      const entries = ((listRes.rows || []) as Array<Record<string, unknown>>).map((row) => ({
        ...row,
        createdAt: timestampToMillis(Number(row.createdAt)) ?? Date.now()
      }))
      return { entries, total }
    },

    async editEntry(embeddingId: string, newText: string): Promise<void> {
      if (!newText.trim()) return
      const adapter = await resolveEmbeddingAdapter(deps)
      if (!adapter) throw new Error('嵌入模型未配置')

      const client = deps.rawSqlClient as {
        execute?: (q: { sql: string; args: unknown[] }) => Promise<{ rows: unknown[] }>
      }
      if (!client?.execute) throw new Error('数据库不可用')

      const rowRes = await client.execute({
        sql: `SELECT source_type, source_id, group_id, chunk_index, metadata_json FROM ${HYBRID_SEARCH_TABLE} WHERE embedding_id = ? LIMIT 1`,
        args: [embeddingId]
      })
      const row = rowRes.rows?.[0] as Record<string, unknown> | undefined
      if (!row) throw new Error('记忆条目不存在')

      await deps.hsRepo.deleteEmbeddingsBySource(String(row.source_type), String(row.source_id))
      await adapter.embedText({
        text: newText,
        sourceType: String(row.source_type),
        sourceId: String(row.source_id),
        groupId: String(row.group_id || 'manual_edit')
      })
    },

    async addManualMemory(text: string): Promise<void> {
      const adapter = await resolveEmbeddingAdapter(deps)
      if (!adapter) throw new Error('嵌入模型未配置')
      const id = `manual-${Date.now()}`
      await adapter.embedText({
        text,
        sourceType: 'manual',
        sourceId: id,
        groupId: 'manual_memory'
      })
    },

    async deleteEntry(embeddingId: string): Promise<void> {
      const client = deps.rawSqlClient as {
        execute?: (q: { sql: string; args: unknown[] }) => Promise<unknown>
      }
      if (!client?.execute) return
      await client.execute({
        sql: `DELETE FROM ${HYBRID_SEARCH_TABLE} WHERE embedding_id = ?`,
        args: [embeddingId]
      })
    },

    async clearAll(): Promise<void> {
      await deps.hsRepo.clearEmbeddings()
      const globalModels = (await deps.settingsManager.get<any>('global_models')) || {}
      globalModels.globalEmbeddingDimension = 0
      await deps.settingsManager.set('global_models', globalModels)

      const ragConfig = (await deps.settingsManager.get<any>('rag_config')) || {}
      ragConfig.totalEmbeddings = 0
      await deps.settingsManager.set('rag_config', ragConfig)
    }
  }

  return service
}

export type MobileRagService = ReturnType<typeof createMobileRagService>
