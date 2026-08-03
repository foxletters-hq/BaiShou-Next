import i18n from 'i18next'
import {
  EMBEDDING_SOURCE_SORT_MILLIS_SQL,
  EMBEDDING_SOURCE_SORT_ORDER_SQL,
  buildMemoryMetadataJson,
  logger,
  MEMORY_SOURCE_TYPE,
  parseMemoryMetadataJson,
  SEMANTIC_SEARCH_TIMEOUT_MS,
  timestampToMillis,
  withPromiseTimeout,
  type MemoryRawRecord
} from '@baishou/shared'
import { MobileRagAbortError, mobileRagOperationControl } from './mobile-rag-operation-control'
import { countDiaryEmbeddingsForVault } from './mobile-diary-embedding.util'
import {
  chainRagProgressCallback,
  vaultNameListFilterSql,
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
import {
  getMobileMemoryRawManager,
  getMobileRawDataSourceManager
} from './mobile-raw-data-source.runtime'
import { shardMonthFromInstant } from '@baishou/core-mobile'

const HYBRID_SEARCH_TABLE = 'memory_embeddings'

type RawSqlClient = {
  execute?: (q: { sql: string; args: unknown[] }) => Promise<{ rows: unknown[] }>
}

function newMemoryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `mem_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function enrichMobileEntry(row: {
  embeddingId: string
  text: string
  modelId?: string
  createdAt: number
  sourceType?: string
  sourceId?: string
  similarity?: number
  metadataJson?: string | null
}) {
  const meta = parseMemoryMetadataJson(row.metadataJson)
  const isMemoryLike = row.sourceType === MEMORY_SOURCE_TYPE || row.sourceType === 'manual'
  const sourceSessionId = isMemoryLike
    ? meta.sourceSessionId !== undefined
      ? meta.sourceSessionId
      : row.sourceType === 'manual'
        ? null
        : undefined
    : undefined
  const isManual =
    row.sourceType === 'manual' ||
    (row.sourceType === MEMORY_SOURCE_TYPE && meta.sourceSessionId === null)
  return {
    embeddingId: row.embeddingId,
    text: row.text,
    modelId: row.modelId || '',
    createdAt: meta.createdAt ?? row.createdAt,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    similarity: row.similarity,
    tags: meta.tags ?? [],
    sourceSessionId,
    memoryCreatedAt: meta.createdAt,
    memoryUpdatedAt: meta.updatedAt,
    isManual
  }
}

async function loadMetadataMap(
  client: RawSqlClient | undefined,
  embeddingIds: string[]
): Promise<Map<string, { sourceId: string; metadataJson: string | null }>> {
  const map = new Map<string, { sourceId: string; metadataJson: string | null }>()
  if (!client?.execute || embeddingIds.length === 0) return map
  for (const embeddingId of embeddingIds) {
    const res = await client.execute({
      sql: `SELECT source_id as sourceId, metadata_json as metadataJson FROM ${HYBRID_SEARCH_TABLE} WHERE embedding_id = ? LIMIT 1`,
      args: [embeddingId]
    })
    const row = res.rows?.[0] as Record<string, unknown> | undefined
    if (row) {
      map.set(embeddingId, {
        sourceId: String(row.sourceId ?? ''),
        metadataJson: (row.metadataJson as string | null) ?? null
      })
    }
  }
  return map
}

async function tombstoneAllMemoryShards(): Promise<void> {
  const memoryMgr = getMobileMemoryRawManager()
  if (!memoryMgr) return
  const now = Date.now()
  for (const shard of await memoryMgr.listShards()) {
    const rows = await memoryMgr.readCollapsedShard(shard.shardMonth)
    if (rows.length === 0) continue
    const tombstones = rows.map((row) => ({
      ...row,
      updatedAt: row.deletedAt != null ? row.updatedAt : now,
      deletedAt: row.deletedAt ?? now
    }))
    const content = `${tombstones.map((row) => JSON.stringify(row)).join('\n')}\n`
    await memoryMgr.replaceShardContent(shard.shardMonth, content)
  }
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
      const scopeFilter = vaultNameListFilterSql(activeVaultName)

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
              const results = await deps.hsRepo.queryNativeVector(vector, fetchLimit, {
                threshold: params.minSimilarity,
                sourceType: params.sourceType,
                vaultName: activeVaultName
              })
              const entriesRaw = results.map((r) => ({
                embeddingId: r.messageId,
                text: r.chunkText,
                createdAt: timestampToMillis(r.createdAt) ?? Date.now(),
                sourceType: r.sourceType,
                sourceId: r.sourceId,
                similarity: r.score
              }))
              const metaMap = await loadMetadataMap(
                deps.rawSqlClient as RawSqlClient | undefined,
                entriesRaw.map((e) => e.embeddingId)
              )
              const entries = entriesRaw.map((e) => {
                const meta = metaMap.get(e.embeddingId)
                return enrichMobileEntry({
                  ...e,
                  sourceId: meta?.sourceId ?? e.sourceId,
                  metadataJson: meta?.metadataJson
                })
              })
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
        const fts = await deps.hsRepo.queryFTS(keyword, limit + offset, {
          vaultName: activeVaultName
        })
        const page = fts.slice(offset, offset + limit)
        const metaMap = await loadMetadataMap(
          deps.rawSqlClient as RawSqlClient | undefined,
          page.map((r) => r.messageId)
        )
        const entries = page.map((r) => {
          const meta = metaMap.get(r.messageId)
          return enrichMobileEntry({
            embeddingId: r.messageId,
            text: r.chunkText,
            createdAt: timestampToMillis(r.createdAt) ?? Date.now(),
            sourceType: r.sourceType,
            sourceId: meta?.sourceId ?? r.sourceId,
            metadataJson: meta?.metadataJson
          })
        })
        return { entries, total: fts.length }
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
              source_id as sourceId, metadata_json as metadataJson, model_id as modelId,
              ${EMBEDDING_SOURCE_SORT_MILLIS_SQL} as createdAt
              FROM ${HYBRID_SEARCH_TABLE}
              WHERE ${scopeFilter.clause}
              ORDER BY ${EMBEDDING_SOURCE_SORT_ORDER_SQL}
              LIMIT ? OFFSET ?`,
        args: [...scopeFilter.args, limit, offset]
      })
      const entries = ((listRes.rows || []) as Array<Record<string, unknown>>).map((row) =>
        enrichMobileEntry({
          embeddingId: String(row.embeddingId ?? ''),
          text: String(row.text ?? ''),
          modelId: String(row.modelId ?? ''),
          createdAt: timestampToMillis(Number(row.createdAt)) ?? Date.now(),
          sourceType: row.sourceType as string | undefined,
          sourceId: row.sourceId as string | undefined,
          metadataJson: (row.metadataJson as string | null) ?? null
        })
      )
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
        sql: `SELECT source_type, source_id, group_id, vault_name, chunk_index, metadata_json, source_created_at FROM ${HYBRID_SEARCH_TABLE} WHERE embedding_id = ? LIMIT 1`,
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

      const sourceType = String(row.source_type)
      const sourceId = String(row.source_id)
      const trimmed = newText.trim()

      if (sourceType !== MEMORY_SOURCE_TYPE && sourceType !== 'manual') {
        const vaultScope = await resolveVaultScope(deps)
        const vaultName =
          String((row as { vault_name?: unknown }).vault_name ?? '').trim() ||
          (await vaultScope.resolveActiveVaultName())
        await deps.hsRepo.deleteEmbeddingsBySource(sourceType, sourceId)
        await adapter.embedText({
          text: trimmed,
          sourceType,
          sourceId,
          groupId: String(row.group_id || 'manual_edit'),
          vaultName
        })
        return
      }

      const vaultScope = await resolveVaultScope(deps)
      const vaultName = await vaultScope.resolveActiveVaultName()
      const rawManager = getMobileRawDataSourceManager()
      const memoryMgr = getMobileMemoryRawManager()
      const createdAtRaw = row.source_created_at
      let createdAtMs =
        typeof createdAtRaw === 'number'
          ? createdAtRaw > 1e12
            ? createdAtRaw
            : createdAtRaw * 1000
          : Date.now()
      const shardMonth = shardMonthFromInstant(createdAtMs)
      let existing: MemoryRawRecord | undefined
      if (memoryMgr) {
        const rows = await memoryMgr.readCollapsedShard(shardMonth)
        existing = rows.find((r) => r.id === sourceId && r.deletedAt == null)
        if (!existing) {
          for (const shard of await memoryMgr.listShards()) {
            const collapsed = await memoryMgr.readCollapsedShard(shard.shardMonth)
            existing = collapsed.find((r) => r.id === sourceId && r.deletedAt == null)
            if (existing) break
          }
        }
      }
      const now = Date.now()
      const createdAt = existing?.createdAt ?? createdAtMs
      const updated: MemoryRawRecord = {
        id: sourceId,
        schemaVersion: 1,
        vaultName: existing?.vaultName ?? vaultName,
        content: trimmed,
        tags: existing?.tags ?? [],
        sourceSessionId: existing?.sourceSessionId ?? null,
        createdAt,
        updatedAt: now,
        deletedAt: null,
        ...(existing?.legacySourceId ? { legacySourceId: existing.legacySourceId } : {})
      }
      if (!rawManager) {
        throw new Error('RawDataSourceManager not ready')
      }
      const written = await rawManager.writeRecord('memory', updated)
      await deps.hsRepo.deleteEmbeddingsBySource(sourceType, sourceId)
      if (sourceType === 'manual') {
        await deps.hsRepo.deleteEmbeddingsBySource(MEMORY_SOURCE_TYPE, sourceId)
      }
      await adapter.embedText({
        text: trimmed,
        sourceType: MEMORY_SOURCE_TYPE,
        sourceId,
        groupId: `memory:${updated.vaultName}`,
        vaultName: updated.vaultName,
        metadataJson: buildMemoryMetadataJson(updated),
        sourceCreatedAt: createdAt
      })
      await memoryMgr?.commitIndexed(written.relativePath, written.contentHash)
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
      const rawManager = getMobileRawDataSourceManager()
      if (!rawManager) {
        throw new Error('RawDataSourceManager not ready')
      }
      const vaultScope = await resolveVaultScope(deps)
      const vaultName = await vaultScope.resolveActiveVaultName()
      const now = Date.now()
      const id = newMemoryId()
      const content = text.trim()
      const record: MemoryRawRecord = {
        id,
        schemaVersion: 1,
        vaultName,
        content,
        tags: [],
        sourceSessionId: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      }
      const written = await rawManager.writeRecord('memory', record)
      await adapter.embedText({
        text: content,
        sourceType: MEMORY_SOURCE_TYPE,
        sourceId: id,
        groupId: `memory:${vaultName}`,
        vaultName,
        metadataJson: buildMemoryMetadataJson(record),
        sourceCreatedAt: now
      })
      const memoryMgr = getMobileMemoryRawManager()
      await memoryMgr?.commitIndexed(written.relativePath, written.contentHash)
    },

    async deleteEntry(embeddingId: string): Promise<void> {
      const client = deps.rawSqlClient as {
        execute?: (q: { sql: string; args: unknown[] }) => Promise<{ rows: unknown[] }>
      }
      if (!client?.execute) return
      const rowRes = await client.execute({
        sql: `SELECT source_type, source_id, source_created_at FROM ${HYBRID_SEARCH_TABLE} WHERE embedding_id = ? LIMIT 1`,
        args: [embeddingId]
      })
      const row = rowRes.rows?.[0] as Record<string, unknown> | undefined
      if (!row) return

      const sourceType = String(row.source_type)
      const sourceId = String(row.source_id)
      if (sourceType === MEMORY_SOURCE_TYPE || sourceType === 'manual') {
        const createdAtRaw = row.source_created_at
        const createdAtMs =
          typeof createdAtRaw === 'number'
            ? createdAtRaw > 1e12
              ? createdAtRaw
              : createdAtRaw * 1000
            : undefined
        const shardMonth =
          createdAtMs != null ? shardMonthFromInstant(createdAtMs) : undefined
        const rawManager = getMobileRawDataSourceManager()
        try {
          await rawManager?.tombstone('memory', sourceId, { shardMonth })
        } catch {
          // legacy / already-absent
        }
        await deps.hsRepo.deleteEmbeddingsBySource(sourceType, sourceId)
        if (sourceType === 'manual') {
          await deps.hsRepo.deleteEmbeddingsBySource(MEMORY_SOURCE_TYPE, sourceId)
        }
        return
      }

      await client.execute({
        sql: `DELETE FROM ${HYBRID_SEARCH_TABLE} WHERE embedding_id = ?`,
        args: [embeddingId]
      })
    },

    async clearAll(): Promise<void> {
      await tombstoneAllMemoryShards()
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
