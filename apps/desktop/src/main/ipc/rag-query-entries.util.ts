import { eq, and, or, sql } from 'drizzle-orm'
import { memoryEmbeddingsTable } from '@baishou/database-desktop'
import {
  GRAPH_NODE_SOURCE_TYPE,
  graphNodeEmbeddingId,
  MEMORY_SOURCE_TYPE,
  parseMemoryMetadataJson,
  timestampToMillis,
  type RagVectorKindFilter
} from '@baishou/shared'
import { getAppDb } from '../db'

export function memorySourceKindFilter(sourceKind?: RagVectorKindFilter) {
  if (!sourceKind || sourceKind === 'all' || sourceKind === 'graph_node') return undefined
  if (sourceKind === 'diary') return eq(memoryEmbeddingsTable.sourceType, 'diary')
  if (sourceKind === 'manual') {
    return or(
      eq(memoryEmbeddingsTable.sourceType, 'manual'),
      and(
        eq(memoryEmbeddingsTable.sourceType, MEMORY_SOURCE_TYPE),
        sql`json_extract(${memoryEmbeddingsTable.metadataJson}, '$.sourceSessionId') IS NULL`
      )
    )
  }
  return and(
    eq(memoryEmbeddingsTable.sourceType, MEMORY_SOURCE_TYPE),
    sql`json_extract(${memoryEmbeddingsTable.metadataJson}, '$.sourceSessionId') IS NOT NULL`
  )
}

export function graphNodeToEntry(row: {
  id: string
  name: string
  summary: string
  modelId: string
  updatedAt: number
  similarity?: number
}) {
  return {
    embeddingId: graphNodeEmbeddingId(row.id),
    text: `${row.name}\n${row.summary || ''}`.trim(),
    modelId: row.modelId || 'unknown',
    createdAt: row.updatedAt,
    sourceType: GRAPH_NODE_SOURCE_TYPE,
    sourceId: row.id,
    tags: [] as string[],
    sourceSessionId: undefined,
    memoryCreatedAt: undefined,
    memoryUpdatedAt: undefined,
    isManual: false,
    similarity: row.similarity
  }
}

export function embeddingInstantMs(value: unknown): number | undefined {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return timestampToMillis(value)
  return undefined
}

export function enrichEntryFromMetadata(base: {
  embeddingId: string
  text: string
  modelId: string
  createdAt: number
  sourceType?: string
  similarity?: number
  sourceId?: string | null
  metadataJson?: string | null
}) {
  const meta = parseMemoryMetadataJson(base.metadataJson)
  const isMemoryLike = base.sourceType === MEMORY_SOURCE_TYPE || base.sourceType === 'manual'
  const sourceSessionId = isMemoryLike
    ? meta.sourceSessionId !== undefined
      ? meta.sourceSessionId
      : base.sourceType === 'manual'
        ? null
        : undefined
    : undefined
  const isManual =
    base.sourceType === 'manual' ||
    (base.sourceType === MEMORY_SOURCE_TYPE && meta.sourceSessionId === null)
  return {
    embeddingId: base.embeddingId,
    text: base.text,
    modelId: base.modelId,
    createdAt: meta.createdAt ?? base.createdAt,
    sourceType: base.sourceType,
    similarity: base.similarity,
    sourceId: base.sourceId ?? undefined,
    tags: meta.tags ?? [],
    sourceSessionId,
    memoryCreatedAt: meta.createdAt,
    memoryUpdatedAt: meta.updatedAt,
    isManual
  }
}

export async function loadMetadataByEmbeddingIds(
  embeddingIds: string[]
): Promise<Map<string, { sourceId: string; metadataJson: string | null }>> {
  const map = new Map<string, { sourceId: string; metadataJson: string | null }>()
  if (embeddingIds.length === 0) return map
  const db = getAppDb()
  for (const embeddingId of embeddingIds) {
    const rows = await db
      .select({
        embeddingId: memoryEmbeddingsTable.embeddingId,
        sourceId: memoryEmbeddingsTable.sourceId,
        metadataJson: memoryEmbeddingsTable.metadataJson
      })
      .from(memoryEmbeddingsTable)
      .where(eq(memoryEmbeddingsTable.embeddingId, embeddingId))
      .limit(1)
    const row = rows[0]
    if (row) {
      map.set(row.embeddingId, {
        sourceId: row.sourceId,
        metadataJson: row.metadataJson
      })
    }
  }
  return map
}
