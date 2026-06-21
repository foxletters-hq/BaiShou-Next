import { AIProviderRegistry, EmbeddingAdapter, HybridSearchService } from '@baishou/ai'
import {
  diaryDateToSourceCreatedSeconds,
  EMBEDDING_SOURCE_SORT_MILLIS_SQL,
  EMBEDDING_SOURCE_SORT_ORDER_SQL,
  filterUnindexedDiaries,
  formatLocalDate,
  isRagMemoryEnabled,
  limitExecute,
  resolveBatchEmbedConcurrency,
  sortDiariesByDateAsc,
  timestampToMillis,
  logger
} from '@baishou/shared'
import { SqliteHybridSearchRepository } from '@baishou/database'
import type { SettingsManagerService, DiaryService } from '@baishou/core-mobile'

const HYBRID_SEARCH_TABLE = 'memory_embeddings'

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
  groupId: string
}

async function loadEmbeddedDiaryIndex(deps: MobileRagServiceDeps): Promise<{
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

  const result = await client.execute({
    sql: `SELECT source_id as sourceId, metadata_json as metadataJson FROM ${HYBRID_SEARCH_TABLE} WHERE source_type = 'diary'`,
    args: []
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
  params: EmbedDiaryEntryParams
): Promise<void> {
  const ragConfig = (await deps.settingsManager.get<{ ragEnabled?: boolean }>('rag_config')) || {}
  if (!isRagMemoryEnabled({ ragEnabled: ragConfig.ragEnabled ?? true })) return

  const adapter = await resolveEmbeddingAdapter(deps)
  if (!adapter) return

  const globalModels =
    (await deps.settingsManager.get<{ globalEmbeddingDimension?: number }>('global_models')) || {}
  const dimension = globalModels.globalEmbeddingDimension
  if (dimension && dimension > 0) {
    await deps.hsRepo.initVectorIndex(dimension)
  }

  await deps.hsRepo.deleteEmbeddingsBySource('diary', String(params.diaryId))

  const d = params.date instanceof Date ? params.date : new Date(params.date)
  const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const tagPrefix = params.tags.length > 0 ? `[标签: ${params.tags.join(', ')}] ` : ''
  const prefixedText = `${tagPrefix}[${label} 日记:]\n${params.content}`
  const metadataJson = JSON.stringify({ updated_at: params.updatedAt.getTime() })
  const embedArgs = {
    text: prefixedText,
    sourceType: 'diary',
    sourceId: String(params.diaryId),
    groupId: params.groupId,
    sourceCreatedAt: diaryDateToSourceCreatedSeconds(d) * 1000,
    metadataJson,
    requireSuccess: true as const
  }

  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await adapter.embedText(embedArgs)
      return
    } catch (error) {
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
      } else {
        throw error
      }
    }
  }
}

export function createMobileRagService(deps: MobileRagServiceDeps) {
  const service = {
    async getStats(): Promise<{ totalCount: number; currentDimension: number }> {
      const globalModels = (await deps.settingsManager.get<any>('global_models')) || {}
      let totalCount = 0
      try {
        const client = deps.rawSqlClient as {
          execute?: (q: { sql: string; args: unknown[] }) => Promise<{ rows: unknown[] }>
        }
        if (client?.execute) {
          const result = await client.execute({
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

      let currentDimension = globalModels.globalEmbeddingDimension || 0
      try {
        const meta = await deps.hsRepo.getCurrentEmbeddingMeta()
        if (meta?.dimension) {
          currentDimension = meta.dimension
        }
      } catch (e) {
        logger.warn('[MobileRag] getCurrentEmbeddingMeta failed', e as Error)
      }

      return { totalCount, currentDimension }
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
      await deps.hsRepo.clearEmbeddings()

      const globalModels = (await deps.settingsManager.get<any>('global_models')) || {}
      globalModels.globalEmbeddingDimension = 0
      await deps.settingsManager.set('global_models', globalModels)

      const ragConfig = (await deps.settingsManager.get<any>('rag_config')) || {}
      ragConfig.totalEmbeddings = 0
      await deps.settingsManager.set('rag_config', ragConfig)

      onProgress?.({ current: 0, total: 1, status: 'detect-dimension' })
      await service.detectDimension()

      return service.batchEmbed(onProgress)
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
      const adapter = await resolveEmbeddingAdapter(deps)
      if (!adapter) {
        throw new Error('嵌入模型未配置')
      }

      const globalModels = await deps.settingsManager.get<any>('global_models')
      const dimension = globalModels?.globalEmbeddingDimension
      if (dimension > 0) {
        await deps.hsRepo.initVectorIndex(dimension)
      }

      const allDiaries = sortDiariesByDateAsc(await deps.diaryService.listAll({ limit: 10000 }))
      const { embeddedIds, embeddedUpdatedAtMap } = await loadEmbeddedDiaryIndex(deps)
      const diaries = filterUnindexedDiaries(allDiaries, embeddedIds, embeddedUpdatedAtMap)
      const total = diaries.length
      const ragSettings =
        (await deps.settingsManager.get<{ batchEmbedConcurrency?: number }>('rag_config')) || {}
      const batchConcurrency = resolveBatchEmbedConcurrency(ragSettings.batchEmbedConcurrency)
      let embedded = 0
      let completed = 0

      await limitExecute(diaries, batchConcurrency, async (meta) => {
        const dateLabel = meta.date
          ? formatLocalDate(meta.date instanceof Date ? meta.date : new Date(meta.date))
          : ''
        onProgress?.({
          current: completed,
          total,
          status: `处理日记: ${dateLabel}`
        })

        const diary = await deps.diaryService.findById(meta.id)
        if (!diary?.id || !diary.content?.trim()) {
          completed++
          return
        }

        const d = diary.date instanceof Date ? diary.date : new Date(diary.date)
        await embedDiaryEntry(deps, {
          diaryId: diary.id,
          content: diary.content,
          tags: meta.tags ?? [],
          date: d,
          updatedAt: diary.updatedAt ?? new Date(),
          groupId: 'diary_batch'
        })

        embedded++
        completed++
        onProgress?.({
          current: completed,
          total,
          status: `处理日记: ${dateLabel}`
        })
      })

      const ragConfig = (await deps.settingsManager.get<any>('rag_config')) || {}
      ragConfig.totalEmbeddings = embedded
      await deps.settingsManager.set('rag_config', ragConfig)

      return embedded
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

      if (params.mode === 'semantic' && params.keyword?.trim()) {
        const adapter = await resolveEmbeddingAdapter(deps)
        if (adapter) {
          const vector = await adapter.embedQuery(params.keyword)
          if (vector?.length) {
            const baseLimit = Math.max(limit, 50)
            const fetchLimit =
              params.minSimilarity != null ? Math.min(baseLimit * 4, 500) : baseLimit
            const results = await deps.hsRepo.queryNativeVector(
              vector,
              fetchLimit,
              params.minSimilarity,
              params.sourceType
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
        const fts = await deps.hsRepo.queryFTS(keyword, limit + offset)
        const page = fts.slice(offset, offset + limit).map((r) => ({
          embeddingId: r.messageId,
          text: r.chunkText,
          createdAt: timestampToMillis(r.createdAt) ?? Date.now(),
          sourceType: r.sourceType,
          sourceId: r.sourceId,
          similarity: r.score
        }))
        return { entries: page, total: fts.length }
      }

      const client = deps.rawSqlClient as {
        execute?: (q: { sql: string; args: unknown[] }) => Promise<{ rows: unknown[] }>
      }
      if (!client?.execute) return { entries: [], total: 0 }

      const countRes = await client.execute({
        sql: `SELECT COUNT(*) as count FROM ${HYBRID_SEARCH_TABLE}`,
        args: []
      })
      const countRow = countRes.rows?.[0] as Record<string, number> | undefined
      const total = Number(countRow?.count ?? 0)

      const listRes = await client.execute({
        sql: `SELECT embedding_id as embeddingId, chunk_text as text, source_type as sourceType,
              ${EMBEDDING_SOURCE_SORT_MILLIS_SQL} as createdAt
              FROM ${HYBRID_SEARCH_TABLE}
              ORDER BY ${EMBEDDING_SOURCE_SORT_ORDER_SQL}
              LIMIT ? OFFSET ?`,
        args: [limit, offset]
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
