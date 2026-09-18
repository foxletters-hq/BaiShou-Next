import { MEMORY_SOURCE_TYPE, parseMemoryMetadataJson } from '@baishou/shared'

export const HYBRID_SEARCH_TABLE = 'memory_embeddings'

export type RawSqlClient = {
  execute?: (q: { sql: string; args: unknown[] }) => Promise<{ rows: unknown[] }>
}

export function newMemoryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `mem_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function enrichMobileEntry(row: {
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

export async function loadMetadataMap(
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
