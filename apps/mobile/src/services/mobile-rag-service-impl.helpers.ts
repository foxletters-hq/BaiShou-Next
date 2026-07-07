import i18n from 'i18next'
import {
  EMBEDDING_SOURCE_SORT_MILLIS_SQL,
  EMBEDDING_SOURCE_SORT_ORDER_SQL,
  buildDiaryEmbeddingGroupId,
  filterDiaryScopedSearchResults,
  logger,
  SEMANTIC_SEARCH_TIMEOUT_MS,
  timestampToMillis,
  withPromiseTimeout
} from '@baishou/shared'
import { MobileRagAbortError, mobileRagOperationControl } from './mobile-rag-operation-control'
import { countDiaryEmbeddingsForVault } from './mobile-diary-embedding.util'
import {
  chainRagProgressCallback,
  diaryVaultListFilterSql,
  resolveEmbeddingAdapter,
  resolveVaultScope,
  type MobileRagServiceDeps,
  type RagProgressCallback
} from './mobile-rag-core.helpers'
import {
  resolveControlledDiaryBatchEmbedCount,
  runControlledDiaryBatchEmbed,
  runControlledDiaryBatchEmbedCore
} from './mobile-rag-batch-embed.helpers'
import {
  flushDeferredPostSyncEmbed,
  isMobileRagBatchBusy,
  setReembedInFlight
} from './mobile-rag-state.helpers'

const HYBRID_SEARCH_TABLE = 'memory_embeddings'

type RawSqlClient = {
  execute?: (q: { sql: string; args: unknown[] }) => Promise<{ rows: unknown[] }>
}

export function createMobileRagService(deps: MobileRagServiceDeps) {
  const reembedAllInternal = async (onProgress?: RagProgressCallback): Promise<number> => {
    mobileRagOperationControl.reset()
    const reportReembedProgress = chainRagProgressCallback('reembed', onProgress)
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

    reportReembedProgress?.({ current: 0, total: 1, status: 'detect-dimension' })
    if (mobileRagOperationControl.isAborted) {
      throw new MobileRagAbortError(0)
    }

    await service.detectDimension()

    if (mobileRagOperationControl.isAborted) {
      throw new MobileRagAbortError(0)
    }

    const result = await runControlledDiaryBatchEmbedCore(deps, {
      onProgress,
      progressType: 'reembed',
      groupId: 'diary_batch'
    })
    return resolveControlledDiaryBatchEmbedCount(result)
  }

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
      if (isMobileRagBatchBusy()) {
        throw new Error(
          i18n.t(
            'auto.apps.mobile.src.services.mobile.rag.service.impl.helpers.L146',
            '嵌入任务正在进行中，请稍后再试'
          )
        )
      }
      setReembedInFlight(true)
      try {
        return await reembedAllInternal(onProgress)
      } finally {
        setReembedInFlight(false)
        await flushDeferredPostSyncEmbed()
      }
    },

    requestOperationAbort(): void {
      mobileRagOperationControl.requestAbort()
    },

    async detectDimension(): Promise<number> {
      const adapter = await resolveEmbeddingAdapter(deps)
      if (!adapter) {
        throw new Error(
          i18n.t(
            'auto.apps.mobile.src.services.mobile.rag.service.impl.helpers.L164',
            '嵌入模型未配置'
          )
        )
      }

      const vector = await adapter.embedQuery('hi')
      if (!vector?.length) {
        throw new Error(
          i18n.t(
            'auto.apps.mobile.src.services.mobile.rag.service.impl.helpers.L169',
            '嵌入 API 未返回有效向量'
          )
        )
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
      return resolveControlledDiaryBatchEmbedCount(result)
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
        const keyword = params.keyword.trim()
        try {
          return await withPromiseTimeout(
            (async () => {
              const adapter = await resolveEmbeddingAdapter(deps)
              if (!adapter) return { entries: [], total: 0 }

              const vector = await adapter.embedQuery(keyword)
              if (!vector?.length) return { entries: [], total: 0 }

              const baseLimit = Math.max(limit, 50)
              const fetchLimit =
                params.minSimilarity != null ? Math.min(baseLimit * 4, 500) : baseLimit
              const results = filterDiaryScopedSearchResults(
                await deps.hsRepo.queryNativeVector(vector, fetchLimit, {
                  threshold: params.minSimilarity,
                  sourceType: params.sourceType
                }),
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
            })(),
            SEMANTIC_SEARCH_TIMEOUT_MS,
            'semantic search'
          )
        } catch (error) {
          logger.warn('[mobile-rag] semantic search failed', { error })
          throw error
        }
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
      if (!adapter) {
        throw new Error(
          i18n.t(
            'auto.apps.mobile.src.services.mobile.rag.service.impl.helpers.L296',
            '嵌入模型未配置'
          )
        )
      }

      const client = deps.rawSqlClient as {
        execute?: (q: { sql: string; args: unknown[] }) => Promise<{ rows: unknown[] }>
      }
      if (!client?.execute) {
        throw new Error(
          i18n.t(
            'auto.apps.mobile.src.services.mobile.rag.service.impl.helpers.L301',
            '数据库不可用'
          )
        )
      }

      const rowRes = await client.execute({
        sql: `SELECT source_type, source_id, group_id, chunk_index, metadata_json FROM ${HYBRID_SEARCH_TABLE} WHERE embedding_id = ? LIMIT 1`,
        args: [embeddingId]
      })
      const row = rowRes.rows?.[0] as Record<string, unknown> | undefined
      if (!row) {
        throw new Error(
          i18n.t(
            'auto.apps.mobile.src.services.mobile.rag.service.impl.helpers.L308',
            '记忆条目不存在'
          )
        )
      }

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
      if (!adapter) {
        throw new Error(
          i18n.t(
            'auto.apps.mobile.src.services.mobile.rag.service.impl.helpers.L321',
            '嵌入模型未配置'
          )
        )
      }
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
