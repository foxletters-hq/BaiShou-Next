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
  countEmbeddedGraphEntries,
  filterMemoryEntryByKind,
  includeGraphEntries,
  includeMemoryEntries,
  listEmbeddedGraphEntries,
  listEmbeddedGraphEntriesByIds,
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

  const [countRes, graphTotal] = await Promise.all([
    client.execute({
      sql: `SELECT COUNT(*) as count FROM ${HYBRID_SEARCH_TABLE} WHERE ${scopeFilter.clause} AND ${kindSql.clause}`,
      args: [...scopeFilter.args, ...kindSql.args]
    }),
    wantGraph ? countEmbeddedGraphEntries(activeVaultId) : Promise.resolve(0)
  ])
  const countRow = countRes.rows?.[0] as Record<string, number> | undefined
  const total = Number(countRow?.count ?? 0)

  if (wantGraph && total === 0) {
    return listEmbeddedGraphEntries(activeVaultId, { limit, offset })
  }

  if (!wantGraph || graphTotal === 0) {
    const listRes = await client.execute({
      sql: `SELECT embedding_id as embeddingId, chunk_text as text, source_type as sourceType,
                source_id as sourceId, metadata_json as metadataJson, model_id as modelId,
                ${EMBEDDING_SOURCE_SORT_MILLIS_SQL} as createdAt
                FROM ${HYBRID_SEARCH_TABLE}
                WHERE ${scopeFilter.clause} AND ${kindSql.clause}
                ORDER BY ${EMBEDDING_SOURCE_SORT_ORDER_SQL}
                LIMIT ? OFFSET ?`,
      args: [...scopeFilter.args, ...kindSql.args, limit, offset]
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
    return { entries: memoryEntries, total: total + graphTotal }
  }

  try {
    const pageKeysRes = await client.execute({
      sql: `SELECT kind, item_id as itemId FROM (
              SELECT 'm' as kind, embedding_id as item_id, (${EMBEDDING_SOURCE_SORT_MILLIS_SQL}) as sort_ms
              FROM ${HYBRID_SEARCH_TABLE}
              WHERE ${scopeFilter.clause} AND ${kindSql.clause}
              UNION ALL
              SELECT 'g' as kind, id as item_id,
                CASE WHEN updated_at > 1000000000000 THEN updated_at ELSE updated_at * 1000 END as sort_ms
              FROM graph_nodes
              WHERE vault_id = ? AND deleted_at IS NULL AND embedding IS NOT NULL
            )
            ORDER BY sort_ms DESC, item_id DESC
            LIMIT ? OFFSET ?`,
      args: [...scopeFilter.args, ...kindSql.args, activeVaultId, limit, offset]
    })
    const pageKeys = ((pageKeysRes.rows || []) as Array<Record<string, unknown>>).map((r) => ({
      kind: String(r.kind ?? ''),
      itemId: String(r.itemId ?? r.item_id ?? '')
    }))
    const mIds = pageKeys.filter((k) => k.kind === 'm' && k.itemId).map((k) => k.itemId)
    const gIds = pageKeys.filter((k) => k.kind === 'g' && k.itemId).map((k) => k.itemId)

    const [memoryById, graphById] = await Promise.all([
      (async () => {
        const map = new Map<string, ReturnType<typeof enrichMobileEntry>>()
        if (mIds.length === 0) return map
        const placeholders = mIds.map(() => '?').join(', ')
        const rowsRes = await client.execute({
          sql: `SELECT embedding_id as embeddingId, chunk_text as text, source_type as sourceType,
                    source_id as sourceId, metadata_json as metadataJson, model_id as modelId,
                    ${EMBEDDING_SOURCE_SORT_MILLIS_SQL} as createdAt
                    FROM ${HYBRID_SEARCH_TABLE}
                    WHERE embedding_id IN (${placeholders})`,
          args: mIds
        })
        for (const row of (rowsRes.rows || []) as Array<Record<string, unknown>>) {
          const entry = enrichMobileEntry({
            embeddingId: String(row.embeddingId ?? ''),
            text: String(row.text ?? ''),
            modelId: String(row.modelId ?? ''),
            createdAt: timestampToMillis(Number(row.createdAt)) ?? Date.now(),
            sourceType: row.sourceType as string | undefined,
            sourceId: row.sourceId as string | undefined,
            metadataJson: (row.metadataJson as string | null) ?? null
          })
          map.set(entry.embeddingId, entry)
        }
        return map
      })(),
      listEmbeddedGraphEntriesByIds(activeVaultId, gIds)
    ])

    const entries: Array<Record<string, unknown>> = []
    for (const key of pageKeys) {
      const hit = key.kind === 'm' ? memoryById.get(key.itemId) : graphById.get(key.itemId)
      if (hit) entries.push(hit)
    }
    return { entries, total: total + graphTotal }
  } catch {
    // 兼容未建 graph_nodes 表的轻量测试连接
  }

  const listRes = await client.execute({
    sql: `SELECT embedding_id as embeddingId, chunk_text as text, source_type as sourceType,
              source_id as sourceId, metadata_json as metadataJson, model_id as modelId,
              ${EMBEDDING_SOURCE_SORT_MILLIS_SQL} as createdAt
              FROM ${HYBRID_SEARCH_TABLE}
              WHERE ${scopeFilter.clause} AND ${kindSql.clause}
              ORDER BY ${EMBEDDING_SOURCE_SORT_ORDER_SQL}
              LIMIT ? OFFSET ?`,
    args: [...scopeFilter.args, ...kindSql.args, Math.min(total, limit + offset), 0]
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

  const graph = await listEmbeddedGraphEntries(activeVaultId, {
    limit: Math.min(graphTotal, limit + offset),
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
