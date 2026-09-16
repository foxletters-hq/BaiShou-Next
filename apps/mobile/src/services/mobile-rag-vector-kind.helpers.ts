import { GraphRepository } from '@baishou/database'
import {
  GRAPH_NODE_SOURCE_TYPE,
  graphNodeEmbeddingId,
  MEMORY_SOURCE_TYPE,
  parseGraphNodeEmbeddingId,
  type RagVectorKindFilter
} from '@baishou/shared'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'
import { invalidateMobilePendingEmbedCountsCache } from './mobile-pending-embed-counts'

export function includeMemoryEntries(sourceKind?: RagVectorKindFilter): boolean {
  return sourceKind !== 'graph_node'
}

export function includeGraphEntries(sourceKind?: RagVectorKindFilter): boolean {
  return sourceKind === 'all' || sourceKind === 'graph_node'
}

export function memoryKindSql(sourceKind?: RagVectorKindFilter): { clause: string; args: unknown[] } {
  if (!sourceKind || sourceKind === 'all' || sourceKind === 'graph_node') {
    return { clause: '1=1', args: [] }
  }
  if (sourceKind === 'diary') return { clause: 'source_type = ?', args: ['diary'] }
  if (sourceKind === 'manual') {
    return {
      clause: `(source_type = 'manual' OR (source_type = ? AND json_extract(metadata_json, '$.sourceSessionId') IS NULL))`,
      args: [MEMORY_SOURCE_TYPE]
    }
  }
  return {
    clause: `source_type = ? AND json_extract(metadata_json, '$.sourceSessionId') IS NOT NULL`,
    args: [MEMORY_SOURCE_TYPE]
  }
}

export function filterMemoryEntryByKind(
  entry: { sourceType?: string; isManual?: boolean },
  sourceKind?: RagVectorKindFilter
): boolean {
  if (!sourceKind || sourceKind === 'all' || sourceKind === 'graph_node') return true
  if (sourceKind === 'diary') return entry.sourceType === 'diary'
  if (sourceKind === 'manual') return entry.isManual === true || entry.sourceType === 'manual'
  return entry.sourceType === MEMORY_SOURCE_TYPE && !entry.isManual
}

export function graphNodeToMobileEntry(row: {
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
    modelId: row.modelId || '',
    createdAt: row.updatedAt,
    sourceType: GRAPH_NODE_SOURCE_TYPE,
    sourceId: row.id,
    tags: [] as string[],
    isManual: false,
    similarity: row.similarity
  }
}

function graphRepo(): GraphRepository | null {
  const drizzleDb = agentDbRuntimeRef.current?.drizzleDb
  return drizzleDb ? new GraphRepository(drizzleDb) : null
}

export async function listEmbeddedGraphEntries(
  vaultId: string,
  options: { keyword?: string; limit: number; offset: number }
): Promise<{ entries: ReturnType<typeof graphNodeToMobileEntry>[]; total: number }> {
  const repo = graphRepo()
  if (!repo) return { entries: [], total: 0 }
  const [rows, total] = await Promise.all([
    repo.listEmbeddedLiveNodesPage(vaultId, options),
    repo.countEmbeddedLiveNodes(vaultId, options.keyword)
  ])
  return { entries: rows.map((row) => graphNodeToMobileEntry(row)), total }
}

export async function searchEmbeddedGraphEntries(
  vaultId: string,
  vector: number[],
  limit: number
): Promise<ReturnType<typeof graphNodeToMobileEntry>[]> {
  const repo = graphRepo()
  if (!repo) return []
  const hits = await repo.searchNodesByVector(vaultId, vector, limit)
  return hits.map((row) =>
    graphNodeToMobileEntry({
      id: row.id,
      name: row.name,
      summary: row.summary ?? '',
      modelId: row.modelId ?? '',
      updatedAt: row.updatedAt,
      similarity: Number.isFinite(row.distance) ? 1 - row.distance : undefined
    })
  )
}

export async function clearGraphNodeEmbeddingIfNeeded(
  embeddingId: string,
  vaultId: string
): Promise<boolean> {
  const nodeId = parseGraphNodeEmbeddingId(embeddingId)
  if (!nodeId) return false
  const repo = graphRepo()
  if (repo) {
    await repo.clearNodeEmbedding(nodeId, vaultId)
    invalidateMobilePendingEmbedCountsCache()
  }
  return true
}
