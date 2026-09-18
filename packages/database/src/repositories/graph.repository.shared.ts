import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import { GRAPH_SQL_IN_CHUNK, normalizeGraphName, propsHaveSimilarPending } from '@baishou/shared'
import { graphEdgesTable, graphNodesTable } from '../schema/graph'
import type { AppDatabase } from '../types'
import type { GraphEdgeRow, GraphNodeRow } from './graph.repository.types'

function aIsString(x: unknown): x is string {
  return typeof x === 'string'
}

export function parseAliases(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((x): x is string => aIsString(x)) : []
  } catch {
    return []
  }
}

export function nodePropsHaveSimilarPending(propsJson: string | null | undefined): boolean {
  return propsHaveSimilarPending(propsJson)
}

export function nodePropsHaveSuspectReason(propsJson: string | null | undefined): boolean {
  try {
    const parsed = JSON.parse(propsJson || '{}') as { suspectReason?: unknown }
    return typeof parsed.suspectReason === 'string' && parsed.suspectReason.trim().length > 0
  } catch {
    return false
  }
}

export function serializeVector(vector: number[]): Buffer {
  return Buffer.from(new Float32Array(vector).buffer)
}

export function ms(date: Date | null | undefined): number | null {
  if (!date) return null
  return date.getTime()
}

export function chunkIds<T>(ids: T[], size = GRAPH_SQL_IN_CHUNK): T[][] {
  if (ids.length === 0) return []
  const out: T[][] = []
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size))
  return out
}

export const GRAPH_NODE_ROW_COLUMNS = {
  id: graphNodesTable.id,
  vaultId: graphNodesTable.vaultId,
  nodeType: graphNodesTable.nodeType,
  name: graphNodesTable.name,
  nameNormalized: graphNodesTable.nameNormalized,
  discriminator: graphNodesTable.discriminator,
  aliases: graphNodesTable.aliases,
  summary: graphNodesTable.summary,
  propsJson: graphNodesTable.propsJson,
  mentionCount: graphNodesTable.mentionCount,
  firstSeenAt: graphNodesTable.firstSeenAt,
  lastSeenAt: graphNodesTable.lastSeenAt,
  origin: graphNodesTable.origin,
  shardMonth: graphNodesTable.shardMonth,
  reviewStatus: graphNodesTable.reviewStatus,
  modelId: graphNodesTable.modelId,
  dimension: graphNodesTable.dimension,
  createdAt: graphNodesTable.createdAt,
  updatedAt: graphNodesTable.updatedAt,
  deletedAt: graphNodesTable.deletedAt
} as const

type GraphNodeMappedRow = Omit<typeof graphNodesTable.$inferSelect, 'embedding'>

export function mapNode(row: GraphNodeMappedRow): GraphNodeRow {
  return {
    id: row.id,
    vaultId: row.vaultId,
    nodeType: row.nodeType,
    name: row.name,
    nameNormalized: row.nameNormalized || normalizeGraphName(row.name),
    discriminator: row.discriminator ?? '',
    aliases: parseAliases(row.aliases),
    summary: row.summary,
    propsJson: row.propsJson,
    mentionCount: row.mentionCount,
    firstSeenAt: ms(row.firstSeenAt),
    lastSeenAt: ms(row.lastSeenAt),
    origin: row.origin,
    shardMonth: row.shardMonth,
    reviewStatus: row.reviewStatus,
    modelId: row.modelId,
    dimension: row.dimension,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    deletedAt: ms(row.deletedAt)
  }
}

export function mapEdge(row: typeof graphEdgesTable.$inferSelect): GraphEdgeRow {
  return {
    id: row.id,
    vaultId: row.vaultId,
    fromId: row.fromId,
    toId: row.toId,
    edgeType: row.edgeType,
    propsJson: row.propsJson,
    validFrom: ms(row.validFrom),
    validTo: ms(row.validTo),
    isCurrent: !!row.isCurrent,
    sourceKind: row.sourceKind,
    sourceRef: row.sourceRef,
    sourceExcerpt: row.sourceExcerpt,
    sourceContentHash: row.sourceContentHash,
    confidence: row.confidence,
    origin: row.origin,
    reviewStatus: row.reviewStatus,
    shardMonth: row.shardMonth,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    deletedAt: ms(row.deletedAt)
  }
}

/** 裸名（区分信息为空）必须排在最前，其余按区分信息字典序，查询结果才稳定。 */
export function compareDiscriminatorAsc(a: string, b: string): number {
  if (a === b) return 0
  if (a === '') return -1
  if (b === '') return 1
  return a < b ? -1 : 1
}

export function mergeAliases(existing: string[], extra: string[]): string[] {
  const set = new Set<string>()
  for (const a of [...existing, ...extra]) {
    const n = a.trim().replace(/\s+/g, ' ')
    if (n) set.add(n)
  }
  return [...set]
}

export function cosineDistance(a: Float32Array, b: Float32Array): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!
    const y = b[i]!
    dot += x * y
    na += x * x
    nb += y * y
  }
  if (na === 0 || nb === 0) return 1
  const sim = dot / (Math.sqrt(na) * Math.sqrt(nb))
  return 1 - sim
}

export async function selectGraphNodesByIds(
  database: AppDatabase,
  vaultId: string,
  ids: string[]
): Promise<GraphNodeRow[]> {
  if (ids.length === 0) return []
  const out: GraphNodeRow[] = []
  for (const part of chunkIds(ids)) {
    const rows = await database
      .select(GRAPH_NODE_ROW_COLUMNS)
      .from(graphNodesTable)
      .where(
        and(
          eq(graphNodesTable.vaultId, vaultId),
          inArray(graphNodesTable.id, part),
          isNull(graphNodesTable.deletedAt)
        )
      )
    out.push(...rows.map(mapNode))
  }
  return out
}

export async function selectCurrentGraphEdgesTouching(
  database: AppDatabase,
  vaultId: string,
  frontier: string[],
  opts?: { approvedOnly?: boolean }
): Promise<GraphEdgeRow[]> {
  if (frontier.length === 0) return []
  const approvedOnly = opts?.approvedOnly === true
  const out: GraphEdgeRow[] = []
  const seen = new Set<string>()
  // from IN + to IN doubles bind count — use half chunk
  const half = Math.max(50, Math.floor(GRAPH_SQL_IN_CHUNK / 2))
  for (const part of chunkIds(frontier, half)) {
    const rows = await database
      .select()
      .from(graphEdgesTable)
      .where(
        and(
          eq(graphEdgesTable.vaultId, vaultId),
          eq(graphEdgesTable.isCurrent, true),
          isNull(graphEdgesTable.deletedAt),
          or(inArray(graphEdgesTable.fromId, part), inArray(graphEdgesTable.toId, part))
        )
      )
    for (const e of rows) {
      if (approvedOnly && (e.reviewStatus === 'pending' || e.reviewStatus === 'rejected')) continue
      if (seen.has(e.id)) continue
      seen.add(e.id)
      out.push(mapEdge(e))
    }
  }
  return out
}
