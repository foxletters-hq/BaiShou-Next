import {
  EMBEDDING_SOURCE_SORT_MILLIS_SQL,
  EMBEDDING_SOURCE_SORT_ORDER_SQL,
  logger,
  SEMANTIC_SEARCH_TIMEOUT_MS,
  timestampToMillis,
  withPromiseTimeout,
  type RagVectorKindFilter
} from '@baishou/shared'
import {
  resolveEmbeddingAdapter,
  resolveVaultScope,
  vaultIdListFilterSql,
  type MobileRagServiceDeps
} from './mobile-rag-core.helpers'
import {
  filterMemoryEntryByKind,
  includeGraphEntries,
  includeMemoryEntries,
  listEmbeddedGraphEntries,
  memoryKindSql,
  searchEmbeddedGraphEntries
} from './mobile-rag-vector-kind.helpers'
import {
  enrichMobileEntry,
  HYBRID_SEARCH_TABLE,
  loadMetadataMap,
  type RawSqlClient
} from './mobile-rag-entry.helpers'

export async function queryMobileRagEntries(
  deps: MobileRagServiceDeps,
  params: {
    keyword?: string
    limit?: number
    offset?: number
    mode?: 'semantic' | 'text'
    withTotal?: boolean
    minSimilarity?: number
    sourceType?: string
    sourceKind?: RagVectorKindFilter
  }
): Promise<{ entries: Array<Record<string, unknown>>; total: number }> {
  const limit = params.limit ?? 10
  const offset = params.offset ?? 0
  const sourceKind = params.sourceKind
  const wantMemory = includeMemoryEntries(sourceKind)
  const wantGraph = includeGraphEntries(sourceKind)
  const vaultScope = await resolveVaultScope(deps)
  const activeVaultId = await vaultScope.resolveActiveVaultId()
  const scopeFilter = vaultIdListFilterSql(activeVaultId)
  const kindSql = memoryKindSql(sourceKind)

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
          const fetchLimit = params.minSimilarity != null ? Math.min(baseLimit * 4, 500) : baseLimit
          const memoryEntries = wantMemory
            ? await (async () => {
                const results = await deps.hsRepo.queryNativeVector(vector, fetchLimit, {
                  threshold: params.minSimilarity,
                  sourceType: params.sourceType,
                  vaultId: activeVaultId
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
                return entriesRaw
                  .map((e) => {
                    const meta = metaMap.get(e.embeddingId)
                    return enrichMobileEntry({
                      ...e,
                      sourceId: meta?.sourceId ?? e.sourceId,
                      metadataJson: meta?.metadataJson
                    })
                  })
                  .filter((entry) => filterMemoryEntryByKind(entry, sourceKind))
              })()
            : []
          const graphEntries = wantGraph
            ? await searchEmbeddedGraphEntries(activeVaultId, vector, fetchLimit)
            : []
          const entries = [...memoryEntries, ...graphEntries].sort(
            (a, b) => (b.similarity ?? 0) - (a.similarity ?? 0)
          )
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
    const memoryEntries = wantMemory
      ? await (async () => {
          const fts = await deps.hsRepo.queryFTS(keyword, limit + offset, {
            vaultId: activeVaultId
          })
          const metaMap = await loadMetadataMap(
            deps.rawSqlClient as RawSqlClient | undefined,
            fts.map((r) => r.messageId)
          )
          return fts
            .map((r) => {
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
            .filter((entry) => filterMemoryEntryByKind(entry, sourceKind))
        })()
      : []
    const graph = wantGraph
      ? await listEmbeddedGraphEntries(activeVaultId, {
          keyword,
          limit: limit + offset,
          offset: 0
        })
      : { entries: [], total: 0 }
    const merged = [...memoryEntries, ...graph.entries].sort(
      (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
    )
    return {
      entries: merged.slice(offset, offset + limit),
      total: memoryEntries.length + graph.total
    }
  }

  if (!wantMemory && wantGraph) {
    return listEmbeddedGraphEntries(activeVaultId, { limit, offset })
  }

  const client = deps.rawSqlClient as RawSqlClient | undefined
  if (!client?.execute) {
    if (wantGraph) return listEmbeddedGraphEntries(activeVaultId, { limit, offset })
    return { entries: [], total: 0 }
  }

  const countRes = await client.execute({
    sql: `SELECT COUNT(*) as count FROM ${HYBRID_SEARCH_TABLE} WHERE ${scopeFilter.clause} AND ${kindSql.clause}`,
    args: [...scopeFilter.args, ...kindSql.args]
  })
  const countRow = countRes.rows?.[0] as Record<string, number> | undefined
  const total = Number(countRow?.count ?? 0)

  const listRes = await client.execute({
    sql: `SELECT embedding_id as embeddingId, chunk_text as text, source_type as sourceType,
              source_id as sourceId, metadata_json as metadataJson, model_id as modelId,
              ${EMBEDDING_SOURCE_SORT_MILLIS_SQL} as createdAt
              FROM ${HYBRID_SEARCH_TABLE}
              WHERE ${scopeFilter.clause} AND ${kindSql.clause}
              ORDER BY ${EMBEDDING_SOURCE_SORT_ORDER_SQL}
              LIMIT ? OFFSET ?`,
    args: [
      ...scopeFilter.args,
      ...kindSql.args,
      wantGraph ? limit + offset : limit,
      wantGraph ? 0 : offset
    ]
  })
  const memoryEntries = ((listRes.rows || []) as Array<Record<string, unknown>>).map((row) =>
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
  if (!wantGraph) return { entries: memoryEntries, total }

  const graph = await listEmbeddedGraphEntries(activeVaultId, {
    limit: limit + offset,
    offset: 0
  })
  const merged = [...memoryEntries, ...graph.entries].sort(
    (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
  )
  return {
    entries: merged.slice(offset, offset + limit),
    total: total + graph.total
  }
}
