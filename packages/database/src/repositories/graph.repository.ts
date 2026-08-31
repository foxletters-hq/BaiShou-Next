import { and, eq, isNull, like, or, desc, inArray, gte, lte, sql, ne } from 'drizzle-orm'
import {
  graphEdgesTable,
  graphNodeAliasesTable,
  graphNodesTable,
  type GraphEdgeType,
  type GraphNodeType
} from '../schema/graph'
import type { AppDatabase } from '../types'
import {
  GRAPH_PENDING_LIST_LIMIT,
  GRAPH_SQL_IN_CHUNK,
  GRAPH_VECTOR_JS_FALLBACK_SCAN_LIMIT,
  graphNodeIdForEntity,
  normalizeGraphEdgeReviewFields,
  normalizeGraphName,
  preferGraphOrigin,
  shouldKeepIncomingGraphNodeId
} from '@baishou/shared'
import {
  isMissingSqliteFunctionError,
  isSqliteUniqueConstraintError
} from '../utils/sqlite-function-error.util'
import type { GraphRepositoryPort } from './graph.ports'

function parseAliases(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((x): x is string => aIsString(x)) : []
  } catch {
    return []
  }
}

function aIsString(x: unknown): x is string {
  return typeof x === 'string'
}

function serializeVector(vector: number[]): Buffer {
  return Buffer.from(new Float32Array(vector).buffer)
}

function ms(date: Date | null | undefined): number | null {
  if (!date) return null
  return date.getTime()
}

function chunkIds<T>(ids: T[], size = GRAPH_SQL_IN_CHUNK): T[][] {
  if (ids.length === 0) return []
  const out: T[][] = []
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size))
  return out
}

export interface GraphNodeRow {
  id: string
  vaultId: string
  nodeType: string
  name: string
  nameNormalized: string
  aliases: string[]
  summary: string
  propsJson: string
  mentionCount: number
  firstSeenAt: number | null
  lastSeenAt: number | null
  origin: string
  shardMonth: string
  reviewStatus: string
  modelId: string
  dimension: number | null
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface GraphEdgeRow {
  id: string
  vaultId: string
  fromId: string
  toId: string
  edgeType: string
  propsJson: string
  validFrom: number | null
  validTo: number | null
  isCurrent: boolean
  sourceKind: string
  sourceRef: string | null
  sourceExcerpt: string
  sourceContentHash: string | null
  confidence: number
  origin: string
  reviewStatus: string
  shardMonth: string
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export type ApplyRawNodeResult = {
  id: string
  remappedFrom?: string
  remappedFromShardMonth?: string
  writeBackSurvivor?: boolean
}

export interface UpsertNodeInput {
  id?: string
  vaultId: string
  nodeType: GraphNodeType | string
  name: string
  aliases?: string[]
  summary?: string
  propsJson?: string
  embedding?: number[] | null
  modelId?: string
  mentionCount?: number
  firstSeenAt?: number | null
  lastSeenAt?: number | null
  origin?: 'ai' | 'user'
  shardMonth?: string
  reviewStatus?: 'approved' | 'pending' | 'rejected'
  /** When true, skip name/vector disambiguation and upsert by id */
  forceId?: boolean
  createdAt?: number
  updatedAt?: number
  deletedAt?: number | null
}

export interface UpsertEdgeInput {
  id: string
  vaultId: string
  fromId: string
  toId: string
  edgeType: GraphEdgeType | string
  propsJson?: string
  validFrom?: number | null
  validTo?: number | null
  isCurrent?: boolean
  sourceKind?: string
  sourceRef?: string | null
  sourceExcerpt?: string
  sourceContentHash?: string | null
  confidence?: number
  origin?: 'ai' | 'user'
  reviewStatus?: 'approved' | 'pending' | 'rejected'
  shardMonth: string
  createdAt?: number
  updatedAt?: number
  deletedAt?: number | null
}

/** Shortest path between graph nodes (edges in hop order). */
export interface GraphPath {
  nodeIds: string[]
  edges: GraphEdgeRow[]
  /**
   * Parallel to `edges`: whether each hop followed the stored edge direction
   * (`fromId→toId`) or walked it in reverse (`toId→fromId`) during undirected BFS.
   */
  edgeDirections?: Array<'forward' | 'reverse'>
}

function mapNode(row: typeof graphNodesTable.$inferSelect): GraphNodeRow {
  return {
    id: row.id,
    vaultId: row.vaultId,
    nodeType: row.nodeType,
    name: row.name,
    nameNormalized: row.nameNormalized || normalizeGraphName(row.name),
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

function mapEdge(row: typeof graphEdgesTable.$inferSelect): GraphEdgeRow {
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

function mergeAliases(existing: string[], extra: string[]): string[] {
  const set = new Set<string>()
  for (const a of [...existing, ...extra]) {
    const n = a.trim().replace(/\s+/g, ' ')
    if (n) set.add(n)
  }
  return [...set]
}

function cosineDistance(a: Float32Array, b: Float32Array): number {
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

/**
 * SQLite-only graph repository. Does not write Graph/ JSONL files.
 */
export class GraphRepository implements GraphRepositoryPort {
  constructor(private readonly database: AppDatabase) {}

  private async replaceAliases(vaultId: string, nodeId: string, aliases: string[]): Promise<void> {
    await this.database
      .delete(graphNodeAliasesTable)
      .where(eq(graphNodeAliasesTable.nodeId, nodeId))
    const seen = new Set<string>()
    for (const a of aliases) {
      const norm = normalizeGraphName(a)
      if (!norm || seen.has(norm)) continue
      seen.add(norm)
      const id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `a_${nodeId}_${norm}`
      await this.database.insert(graphNodeAliasesTable).values({
        id,
        vaultId,
        nodeId,
        aliasNormalized: norm
      })
    }
  }

  async findNodeByNameOrAlias(
    vaultId: string,
    name: string,
    type?: GraphNodeType | string
  ): Promise<GraphNodeRow | null> {
    const normalized = normalizeGraphName(name)
    if (!normalized) return null
    const typed = type?.trim()

    const nameConditions = [
      eq(graphNodesTable.vaultId, vaultId),
      eq(graphNodesTable.nameNormalized, normalized),
      isNull(graphNodesTable.deletedAt)
    ]
    if (typed) nameConditions.push(eq(graphNodesTable.nodeType, typed))

    const byName = await this.database
      .select()
      .from(graphNodesTable)
      .where(and(...nameConditions))
      .limit(typed ? 1 : 8)

    if (typed) {
      if (byName[0]) return mapNode(byName[0])
      const aliasHits = await this.database
        .select({ nodeId: graphNodeAliasesTable.nodeId })
        .from(graphNodeAliasesTable)
        .where(
          and(
            eq(graphNodeAliasesTable.vaultId, vaultId),
            eq(graphNodeAliasesTable.aliasNormalized, normalized)
          )
        )
        .limit(8)
      for (const hit of aliasHits) {
        const node = await this.getNodeById(hit.nodeId, vaultId)
        if (node && node.nodeType === typed) return node
      }
      return null
    }

    const ids = new Set(byName.map((row) => row.id))
    const aliasHits = await this.database
      .select({ nodeId: graphNodeAliasesTable.nodeId })
      .from(graphNodeAliasesTable)
      .where(
        and(
          eq(graphNodeAliasesTable.vaultId, vaultId),
          eq(graphNodeAliasesTable.aliasNormalized, normalized)
        )
      )
      .limit(16)
    for (const hit of aliasHits) {
      const node = await this.getNodeById(hit.nodeId, vaultId)
      if (node) ids.add(node.id)
    }
    if (ids.size !== 1) return null
    const id = [...ids][0]!
    const named = byName.find((row) => row.id === id)
    return named ? mapNode(named) : this.getNodeById(id, vaultId)
  }

  async searchNodesByVector(
    vaultId: string,
    vector: number[],
    topK: number,
    opts?: { nodeType?: string; modelId?: string }
  ): Promise<Array<GraphNodeRow & { distance: number }>> {
    const query = new Float32Array(vector)
    const buf = serializeVector(vector)

    try {
      const conditions = [
        eq(graphNodesTable.vaultId, vaultId),
        isNull(graphNodesTable.deletedAt),
        sql`${graphNodesTable.embedding} is not null`,
        eq(graphNodesTable.dimension, query.length)
      ]
      if (opts?.nodeType) conditions.push(eq(graphNodesTable.nodeType, opts.nodeType))
      if (opts?.modelId) conditions.push(eq(graphNodesTable.modelId, opts.modelId))

      const rows = await this.database
        .select({
          row: graphNodesTable,
          distance: sql<number>`vec_distance_cosine(${graphNodesTable.embedding}, ${buf})`.as(
            'distance'
          )
        })
        .from(graphNodesTable)
        .where(and(...conditions))
        .orderBy(sql`vec_distance_cosine(${graphNodesTable.embedding}, ${buf}) ASC`)
        .limit(topK)

      return rows.map((r) => ({ ...mapNode(r.row), distance: Number(r.distance) }))
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (!isMissingSqliteFunctionError(message)) throw e
    }

    // JS fallback when sqlite-vec is unavailable
    const filters = [
      eq(graphNodesTable.vaultId, vaultId),
      isNull(graphNodesTable.deletedAt),
      ...(opts?.nodeType ? [eq(graphNodesTable.nodeType, opts.nodeType)] : [])
    ]
    const rows = await this.database
      .select()
      .from(graphNodesTable)
      .where(and(...filters))
      .limit(GRAPH_VECTOR_JS_FALLBACK_SCAN_LIMIT)
    if (rows.length >= GRAPH_VECTOR_JS_FALLBACK_SCAN_LIMIT) {
      console.warn(
        `[GraphRepository] searchNodesByVector JS fallback scanned ${GRAPH_VECTOR_JS_FALLBACK_SCAN_LIMIT} rows`
      )
    }
    const scored: Array<GraphNodeRow & { distance: number }> = []
    for (const row of rows) {
      if (!row.embedding || !row.dimension || row.dimension !== query.length) continue
      if (opts?.modelId && row.modelId && row.modelId !== opts.modelId) continue
      const embBuf = row.embedding as Buffer
      const emb = new Float32Array(embBuf.buffer, embBuf.byteOffset, row.dimension)
      scored.push({ ...mapNode(row), distance: cosineDistance(query, emb) })
    }
    scored.sort((a, b) => a.distance - b.distance)
    return scored.slice(0, topK)
  }

  async searchNodesByName(
    vaultId: string,
    query: string,
    opts?: { nodeTypes?: Array<GraphNodeType | string>; limit?: number }
  ): Promise<GraphNodeRow[]> {
    const q = query.trim()
    if (!q) return []
    const limit = opts?.limit ?? 20
    const pattern = `%${q}%`
    const norm = normalizeGraphName(q)

    const typeFilter =
      opts?.nodeTypes?.length && opts.nodeTypes.length > 0
        ? inArray(graphNodesTable.nodeType, opts.nodeTypes as string[])
        : undefined

    const byName = await this.database
      .select()
      .from(graphNodesTable)
      .where(
        and(
          eq(graphNodesTable.vaultId, vaultId),
          isNull(graphNodesTable.deletedAt),
          or(like(graphNodesTable.name, pattern), eq(graphNodesTable.nameNormalized, norm)),
          typeFilter
        )
      )
      .orderBy(desc(graphNodesTable.mentionCount))
      .limit(limit)

    const aliasRows = await this.database
      .select({ nodeId: graphNodeAliasesTable.nodeId })
      .from(graphNodeAliasesTable)
      .where(
        and(
          eq(graphNodeAliasesTable.vaultId, vaultId),
          or(eq(graphNodeAliasesTable.aliasNormalized, norm), like(graphNodeAliasesTable.aliasNormalized, pattern))
        )
      )
      .limit(limit)

    const seen = new Map<string, GraphNodeRow>()
    for (const row of byName) seen.set(row.id, mapNode(row))
    for (const hit of aliasRows) {
      if (seen.has(hit.nodeId)) continue
      const node = await this.getNodeById(hit.nodeId, vaultId)
      if (!node) continue
      if (opts?.nodeTypes?.length && !opts.nodeTypes.includes(node.nodeType)) continue
      seen.set(node.id, node)
    }
    return [...seen.values()]
      .sort((a, b) => b.mentionCount - a.mentionCount)
      .slice(0, limit)
  }

  /**
   * Write a node by id. Without forceId, reuse an exact name/alias hit of the same type.
   * Does not merge by vector similarity — chat/manual writes are explicit.
   */
  async upsertNode(input: UpsertNodeInput): Promise<string> {
    const now = Date.now()
    const name = input.name.trim().replace(/\s+/g, ' ')
    const nameNormalized = normalizeGraphName(name)
    const updatedAt = input.updatedAt ?? now
    const createdAt = input.createdAt ?? now

    if (!input.forceId) {
      const existing = await this.findNodeByNameOrAlias(input.vaultId, name, input.nodeType)
      if (existing) {
        await this.touchNode(existing.id, {
          aliases: mergeAliases(existing.aliases, input.aliases ?? [name]),
          lastSeenAt: input.lastSeenAt ?? now,
          mentionCount: input.mentionCount ?? existing.mentionCount,
          summary: input.summary ?? existing.summary,
          embedding: input.embedding,
          modelId: input.modelId,
          updatedAt,
          name,
          nameNormalized
        })
        return existing.id
      }
    }

    if (!input.id && input.nodeType === 'entry') {
      throw new Error('GraphRepository.upsertNode: entry requires a path-based id')
    }
    const id = input.id ?? graphNodeIdForEntity(input.vaultId, input.nodeType, name)

    const aliases = mergeAliases([], input.aliases ?? [name])
    const embeddingBuf = input.embedding?.length ? serializeVector(input.embedding) : null
    const existingById = await this.getNodeById(id, input.vaultId)
    const origin = preferGraphOrigin(existingById?.origin, input.origin)
    const values = {
      id,
      vaultId: input.vaultId,
      nodeType: input.nodeType,
      name,
      nameNormalized,
      aliases: JSON.stringify(aliases),
      summary: input.summary ?? '',
      propsJson: input.propsJson ?? '{}',
      embedding: embeddingBuf,
      dimension: input.embedding?.length ?? null,
      modelId: input.modelId ?? '',
      mentionCount: input.mentionCount ?? 1,
      firstSeenAt: input.firstSeenAt != null ? new Date(input.firstSeenAt) : new Date(createdAt),
      lastSeenAt: input.lastSeenAt != null ? new Date(input.lastSeenAt) : new Date(updatedAt),
      origin,
      shardMonth: input.shardMonth ?? '',
      reviewStatus: input.reviewStatus ?? 'approved',
      createdAt: new Date(createdAt),
      updatedAt: new Date(updatedAt),
      deletedAt: input.deletedAt != null ? new Date(input.deletedAt) : null
    }

    const conflictSet = {
      name: values.name,
      nameNormalized: values.nameNormalized,
      aliases: values.aliases,
      summary: values.summary,
      propsJson: values.propsJson,
      mentionCount: values.mentionCount,
      lastSeenAt: values.lastSeenAt,
      origin: values.origin,
      shardMonth: values.shardMonth,
      reviewStatus: values.reviewStatus,
      updatedAt: values.updatedAt,
      deletedAt: values.deletedAt,
      ...(input.embedding?.length
        ? {
            embedding: embeddingBuf,
            dimension: input.embedding.length,
            modelId: input.modelId ?? ''
          }
        : {})
    }

    await this.database
      .insert(graphNodesTable)
      .values(values)
      .onConflictDoUpdate({
        target: [graphNodesTable.id],
        set: conflictSet
      })
    await this.replaceAliases(input.vaultId, id, aliases)
    return id
  }

  private async touchNode(
    id: string,
    patch: {
      aliases: string[]
      lastSeenAt: number
      mentionCount: number
      summary: string
      embedding?: number[] | null
      modelId?: string
      updatedAt: number
      name?: string
      nameNormalized?: string
    }
  ): Promise<void> {
    const set: Record<string, unknown> = {
      aliases: JSON.stringify(patch.aliases),
      lastSeenAt: new Date(patch.lastSeenAt),
      mentionCount: patch.mentionCount,
      summary: patch.summary,
      updatedAt: new Date(patch.updatedAt),
      deletedAt: null
    }
    if (patch.name) set.name = patch.name
    if (patch.nameNormalized) set.nameNormalized = patch.nameNormalized
    if (patch.embedding?.length) {
      set.embedding = serializeVector(patch.embedding)
      set.dimension = patch.embedding.length
      if (patch.modelId) set.modelId = patch.modelId
    }
    await this.database.update(graphNodesTable).set(set).where(eq(graphNodesTable.id, id))
    const node = await this.getNodeById(id)
    if (node) await this.replaceAliases(node.vaultId, id, patch.aliases)
  }

  async upsertEdge(input: UpsertEdgeInput): Promise<string> {
    const now = Date.now()
    const createdAt = input.createdAt ?? now
    const updatedAt = input.updatedAt ?? now
    const review = normalizeGraphEdgeReviewFields({
      confidence: input.confidence,
      reviewStatus: input.reviewStatus,
      fallbackConfidence: 100
    })
    const values = {
      id: input.id,
      vaultId: input.vaultId,
      fromId: input.fromId,
      toId: input.toId,
      edgeType: input.edgeType,
      propsJson: input.propsJson ?? '{}',
      validFrom: input.validFrom != null ? new Date(input.validFrom) : null,
      validTo: input.validTo != null ? new Date(input.validTo) : null,
      isCurrent: input.isCurrent ?? true,
      sourceKind: input.sourceKind ?? 'manual',
      sourceRef: input.sourceRef ?? null,
      sourceExcerpt: input.sourceExcerpt ?? '',
      sourceContentHash: input.sourceContentHash ?? null,
      confidence: review.confidence,
      origin: input.origin ?? 'ai',
      reviewStatus: review.reviewStatus,
      shardMonth: input.shardMonth,
      createdAt: new Date(createdAt),
      updatedAt: new Date(updatedAt),
      deletedAt: input.deletedAt != null ? new Date(input.deletedAt) : null
    }
    await this.database
      .insert(graphEdgesTable)
      .values(values)
      .onConflictDoUpdate({
        target: [graphEdgesTable.id],
        set: {
          fromId: values.fromId,
          toId: values.toId,
          edgeType: values.edgeType,
          propsJson: values.propsJson,
          validFrom: values.validFrom,
          validTo: values.validTo,
          isCurrent: values.isCurrent,
          sourceKind: values.sourceKind,
          sourceRef: values.sourceRef,
          sourceExcerpt: values.sourceExcerpt,
          sourceContentHash: values.sourceContentHash,
          confidence: values.confidence,
          origin: values.origin,
          reviewStatus: values.reviewStatus,
          shardMonth: values.shardMonth,
          updatedAt: values.updatedAt,
          deletedAt: values.deletedAt
        }
      })
    return input.id
  }

  async supersedeEdge(edgeId: string, validTo: number): Promise<void> {
    await this.database
      .update(graphEdgesTable)
      .set({
        isCurrent: false,
        validTo: new Date(validTo),
        updatedAt: new Date()
      })
      .where(eq(graphEdgesTable.id, edgeId))
  }

  async supersedeEdgesBySourceRef(
    vaultId: string,
    sourceRef: string,
    opts?: { keepUserOrigin?: boolean; exceptIds?: ReadonlySet<string> }
  ): Promise<void> {
    const now = Date.now()
    const rows = await this.database
      .select()
      .from(graphEdgesTable)
      .where(
        and(
          eq(graphEdgesTable.vaultId, vaultId),
          eq(graphEdgesTable.sourceRef, sourceRef),
          eq(graphEdgesTable.isCurrent, true),
          isNull(graphEdgesTable.deletedAt)
        )
      )
    for (const row of rows) {
      if (opts?.keepUserOrigin && row.origin === 'user') continue
      if (opts?.exceptIds?.has(row.id)) continue
      await this.supersedeEdge(row.id, now)
    }
  }

  private async selectNodesByIds(vaultId: string, ids: string[]): Promise<GraphNodeRow[]> {
    if (ids.length === 0) return []
    const out: GraphNodeRow[] = []
    for (const part of chunkIds(ids)) {
      const rows = await this.database
        .select()
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

  private async selectCurrentEdgesTouching(
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
      const rows = await this.database
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

  async traverse(
    vaultId: string,
    centerId: string,
    depth: 1 | 2 | 3,
    opts?: { approvedOnly?: boolean }
  ): Promise<{ nodes: GraphNodeRow[]; edges: GraphEdgeRow[] }> {
    const approvedOnly = opts?.approvedOnly === true
    const hops = Math.min(3, Math.max(1, Math.floor(depth))) as 1 | 2 | 3
    const nodeIds = new Set<string>([centerId])
    const edgeIds = new Set<string>()
    const edgeRows: GraphEdgeRow[] = []
    let frontier = [centerId]
    for (let d = 0; d < hops; d++) {
      if (frontier.length === 0) break
      const edges = await this.selectCurrentEdgesTouching(vaultId, frontier, { approvedOnly })
      const next: string[] = []
      for (const e of edges) {
        if (!edgeIds.has(e.id)) {
          edgeIds.add(e.id)
          edgeRows.push(e)
        }
        for (const id of [e.fromId, e.toId]) {
          if (!nodeIds.has(id)) {
            nodeIds.add(id)
            next.push(id)
          }
        }
      }
      frontier = next
    }
    let nodes = await this.selectNodesByIds(vaultId, [...nodeIds])
    if (approvedOnly) {
      nodes = nodes.filter((n) => n.reviewStatus !== 'pending' && n.reviewStatus !== 'rejected')
    }
    return { nodes, edges: edgeRows }
  }

  /**
   * Relation timeline for an entity: includes superseded (isCurrent=false) edges,
   * ordered by validFrom. Used by GraphRAG timeline mode.
   */
  async listEntityTimeline(
    vaultId: string,
    nodeId: string,
    opts?: { approvedOnly?: boolean; limit?: number }
  ): Promise<{ nodes: GraphNodeRow[]; edges: GraphEdgeRow[] }> {
    const approvedOnly = opts?.approvedOnly !== false
    const limit = opts?.limit ?? 80
    const reviewFilter = approvedOnly
      ? and(ne(graphEdgesTable.reviewStatus, 'pending'), ne(graphEdgesTable.reviewStatus, 'rejected'))
      : undefined
    const rows = await this.database
      .select()
      .from(graphEdgesTable)
      .where(
        and(
          eq(graphEdgesTable.vaultId, vaultId),
          isNull(graphEdgesTable.deletedAt),
          or(eq(graphEdgesTable.fromId, nodeId), eq(graphEdgesTable.toId, nodeId)),
          reviewFilter
        )
      )
      .orderBy(sql`coalesce(${graphEdgesTable.validFrom}, ${graphEdgesTable.createdAt}) ASC`)
      .limit(limit)
    const edges = rows.map(mapEdge)
    const idSet = new Set<string>([nodeId])
    for (const e of edges) {
      idSet.add(e.fromId)
      idSet.add(e.toId)
    }
    let nodes = await this.selectNodesByIds(vaultId, [...idSet])
    if (approvedOnly) {
      nodes = nodes.filter((n) => n.reviewStatus !== 'pending' && n.reviewStatus !== 'rejected')
    }
    return { nodes, edges }
  }

  async getGlobalGraph(opts: {
    vaultId: string
    maxNodes?: number
    minMentionCount?: number
    nodeTypes?: Array<GraphNodeType | string>
    /** Inclusive YYYY-MM range; when set, graph includes edges and nodes in that window. */
    monthRange?: { startMonth: string; endMonth: string }
  }): Promise<{ nodes: GraphNodeRow[]; edges: GraphEdgeRow[] }> {
    const maxNodes = opts.maxNodes ?? 200
    const minMention = opts.minMentionCount ?? 0
    const startMonth = opts.monthRange?.startMonth
    const endMonth = opts.monthRange?.endMonth
    const useMonthRange =
      typeof startMonth === 'string' &&
      /^\d{4}-\d{2}$/.test(startMonth) &&
      typeof endMonth === 'string' &&
      /^\d{4}-\d{2}$/.test(endMonth)

    if (useMonthRange) {
      const from = startMonth! <= endMonth! ? startMonth! : endMonth!
      const to = startMonth! <= endMonth! ? endMonth! : startMonth!
      const monthFilter = and(
        eq(graphEdgesTable.vaultId, opts.vaultId),
        eq(graphEdgesTable.isCurrent, true),
        isNull(graphEdgesTable.deletedAt),
        ne(graphEdgesTable.shardMonth, ''),
        gte(graphEdgesTable.shardMonth, from),
        lte(graphEdgesTable.shardMonth, to)
      )
      const fromRows = await this.database
        .select({
          id: graphEdgesTable.fromId,
          c: sql<number>`count(*)`.as('c')
        })
        .from(graphEdgesTable)
        .where(monthFilter)
        .groupBy(graphEdgesTable.fromId)
      const toRows = await this.database
        .select({
          id: graphEdgesTable.toId,
          c: sql<number>`count(*)`.as('c')
        })
        .from(graphEdgesTable)
        .where(monthFilter)
        .groupBy(graphEdgesTable.toId)
      const touch = new Map<string, number>()
      for (const row of fromRows) touch.set(row.id, (touch.get(row.id) ?? 0) + Number(row.c))
      for (const row of toRows) touch.set(row.id, (touch.get(row.id) ?? 0) + Number(row.c))
      const monthNodeRows = await this.database
        .select({
          id: graphNodesTable.id,
          reviewStatus: graphNodesTable.reviewStatus
        })
        .from(graphNodesTable)
        .where(
          and(
            eq(graphNodesTable.vaultId, opts.vaultId),
            isNull(graphNodesTable.deletedAt),
            ne(graphNodesTable.shardMonth, ''),
            gte(graphNodesTable.shardMonth, from),
            lte(graphNodesTable.shardMonth, to)
          )
        )
      for (const row of monthNodeRows) {
        if (!touch.has(row.id)) touch.set(row.id, 0)
      }
      const oversample = opts.nodeTypes?.length || minMention > 0 ? maxNodes * 20 : maxNodes * 4
      const rankedIds = [...touch.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, oversample)
        .map(([id]) => id)
      if (rankedIds.length === 0) return { nodes: [], edges: [] }
      let nodes = await this.selectNodesByIds(opts.vaultId, rankedIds)
      const order = new Map(rankedIds.map((id, i) => [id, i]))
      nodes.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      if (minMention > 0) nodes = nodes.filter((n) => n.mentionCount >= minMention)
      if (opts.nodeTypes?.length) {
        const allow = new Set(opts.nodeTypes)
        nodes = nodes.filter((n) => allow.has(n.nodeType))
      }
      nodes = nodes.slice(0, maxNodes)
      const pendingMissingIds = monthNodeRows
        .filter((row) => row.reviewStatus === 'pending')
        .map((row) => row.id)
        .filter((id) => !nodes.some((n) => n.id === id))
        .slice(0, GRAPH_PENDING_LIST_LIMIT)
      if (pendingMissingIds.length > 0) {
        let extra = await this.selectNodesByIds(opts.vaultId, pendingMissingIds)
        extra = extra.filter((n) => n.reviewStatus === 'pending')
        if (minMention > 0) extra = extra.filter((n) => n.mentionCount >= minMention)
        if (opts.nodeTypes?.length) {
          const allow = new Set(opts.nodeTypes)
          extra = extra.filter((n) => allow.has(n.nodeType))
        }
        nodes = [...nodes, ...extra]
      }
      const idSet = new Set(nodes.map((n) => n.id))
      if (idSet.size === 0) return { nodes: [], edges: [] }
      const edges: GraphEdgeRow[] = []
      const idList = [...idSet]
      const half = Math.max(50, Math.floor(GRAPH_SQL_IN_CHUNK / 2))
      for (const part of chunkIds(idList, half)) {
        const rows = await this.database
          .select()
          .from(graphEdgesTable)
          .where(
            and(
              monthFilter,
              inArray(graphEdgesTable.fromId, part),
              inArray(graphEdgesTable.toId, idList.length <= half ? idList : part)
            )
          )
        for (const e of rows.map(mapEdge)) {
          if (idSet.has(e.fromId) && idSet.has(e.toId)) edges.push(e)
        }
      }
      if (idList.length > half) {
        edges.length = 0
        for (const part of chunkIds(idList, half)) {
          const rows = await this.database
            .select()
            .from(graphEdgesTable)
            .where(and(monthFilter, inArray(graphEdgesTable.fromId, part)))
          for (const e of rows.map(mapEdge)) {
            if (idSet.has(e.fromId) && idSet.has(e.toId)) edges.push(e)
          }
        }
      }
      return { nodes, edges }
    }

    const globalFilters = [
      eq(graphNodesTable.vaultId, opts.vaultId),
      isNull(graphNodesTable.deletedAt)
    ]
    if (minMention > 0) globalFilters.push(gte(graphNodesTable.mentionCount, minMention))
    if (opts.nodeTypes?.length) {
      globalFilters.push(inArray(graphNodesTable.nodeType, opts.nodeTypes as string[]))
    }
    const nodes = (
      await this.database
        .select()
        .from(graphNodesTable)
        .where(and(...globalFilters))
        .orderBy(desc(graphNodesTable.mentionCount))
        .limit(maxNodes)
    ).map(mapNode)
    const idSet = new Set(nodes.map((n) => n.id))
    if (idSet.size === 0) return { nodes: [], edges: [] }

    const edges: GraphEdgeRow[] = []
    const half = Math.max(50, Math.floor(GRAPH_SQL_IN_CHUNK / 2))
    const idList = [...idSet]
    for (const part of chunkIds(idList, half)) {
      const rows = await this.database
        .select()
        .from(graphEdgesTable)
        .where(
          and(
            eq(graphEdgesTable.vaultId, opts.vaultId),
            eq(graphEdgesTable.isCurrent, true),
            isNull(graphEdgesTable.deletedAt),
            inArray(graphEdgesTable.fromId, part),
            inArray(graphEdgesTable.toId, idList.length <= half ? idList : part)
          )
        )
      for (const e of rows.map(mapEdge)) {
        if (idSet.has(e.fromId) && idSet.has(e.toId)) edges.push(e)
      }
    }
    // When id list is large, second filter: load edges where both ends in set via from-chunk only
    if (idList.length > half) {
      edges.length = 0
      for (const part of chunkIds(idList, half)) {
        const rows = await this.database
          .select()
          .from(graphEdgesTable)
          .where(
            and(
              eq(graphEdgesTable.vaultId, opts.vaultId),
              eq(graphEdgesTable.isCurrent, true),
              isNull(graphEdgesTable.deletedAt),
              inArray(graphEdgesTable.fromId, part)
            )
          )
        for (const e of rows.map(mapEdge)) {
          if (idSet.has(e.fromId) && idSet.has(e.toId)) edges.push(e)
        }
      }
    }
    return { nodes, edges }
  }

  async getNodeById(id: string, vaultId?: string): Promise<GraphNodeRow | null> {
    const conditions = [eq(graphNodesTable.id, id), isNull(graphNodesTable.deletedAt)]
    if (vaultId) conditions.push(eq(graphNodesTable.vaultId, vaultId))
    const rows = await this.database
      .select()
      .from(graphNodesTable)
      .where(and(...conditions))
      .limit(1)
    return rows[0] ? mapNode(rows[0]) : null
  }

  async getEdgeById(id: string, vaultId?: string): Promise<GraphEdgeRow | null> {
    const conditions = [eq(graphEdgesTable.id, id), isNull(graphEdgesTable.deletedAt)]
    if (vaultId) conditions.push(eq(graphEdgesTable.vaultId, vaultId))
    const rows = await this.database
      .select()
      .from(graphEdgesTable)
      .where(and(...conditions))
      .limit(1)
    return rows[0] ? mapEdge(rows[0]) : null
  }

  /** Removes the node row. Incident edges are removed unless cascadeEdges is false. */
  async softDeleteNode(id: string, opts?: { cascadeEdges?: boolean }): Promise<void> {
    if (opts?.cascadeEdges !== false) {
      await this.database
        .delete(graphEdgesTable)
        .where(or(eq(graphEdgesTable.fromId, id), eq(graphEdgesTable.toId, id)))
    }
    await this.database.delete(graphNodeAliasesTable).where(eq(graphNodeAliasesTable.nodeId, id))
    await this.database.delete(graphNodesTable).where(eq(graphNodesTable.id, id))
  }

  async listEdgesTouching(vaultId: string, nodeId: string): Promise<GraphEdgeRow[]> {
    const rows = await this.database
      .select()
      .from(graphEdgesTable)
      .where(
        and(
          eq(graphEdgesTable.vaultId, vaultId),
          isNull(graphEdgesTable.deletedAt),
          or(eq(graphEdgesTable.fromId, nodeId), eq(graphEdgesTable.toId, nodeId))
        )
      )
    return rows.map(mapEdge)
  }

  async remapEdgeEndpoints(vaultId: string, fromId: string, toId: string): Promise<void> {
    if (!fromId || !toId || fromId === toId) return
    const now = new Date()
    await this.database
      .update(graphEdgesTable)
      .set({ fromId: toId, updatedAt: now })
      .where(
        and(
          eq(graphEdgesTable.vaultId, vaultId),
          eq(graphEdgesTable.fromId, fromId),
          isNull(graphEdgesTable.deletedAt)
        )
      )
    await this.database
      .update(graphEdgesTable)
      .set({ toId: toId, updatedAt: now })
      .where(
        and(
          eq(graphEdgesTable.vaultId, vaultId),
          eq(graphEdgesTable.toId, fromId),
          isNull(graphEdgesTable.deletedAt)
        )
      )
  }

  /** Removes the edge row. */
  async softDeleteEdge(id: string): Promise<void> {
    await this.database.delete(graphEdgesTable).where(eq(graphEdgesTable.id, id))
  }

  /**
   * Recount mention_count from current live edge endpoints for the given nodes
   * (or all nodes in vault when nodeIds omitted).
   */
  async recountMentions(vaultId: string, nodeIds?: string[]): Promise<void> {
    const ids =
      nodeIds && nodeIds.length > 0
        ? nodeIds
        : (
            await this.database
              .select({ id: graphNodesTable.id })
              .from(graphNodesTable)
              .where(and(eq(graphNodesTable.vaultId, vaultId), isNull(graphNodesTable.deletedAt)))
          ).map((r) => r.id)

    const counts = new Map<string, number>()
    for (const id of ids) counts.set(id, 0)

    const half = Math.max(50, Math.floor(GRAPH_SQL_IN_CHUNK / 2))
    for (const part of chunkIds(ids, half)) {
      const rows = await this.database
        .select({ fromId: graphEdgesTable.fromId, toId: graphEdgesTable.toId })
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
        if (counts.has(e.fromId)) counts.set(e.fromId, (counts.get(e.fromId) ?? 0) + 1)
        if (counts.has(e.toId)) counts.set(e.toId, (counts.get(e.toId) ?? 0) + 1)
      }
    }

    const now = new Date()
    const entries = [...counts.entries()]
    for (const part of chunkIds(entries, 80)) {
      if (part.length === 0) continue
      const cases = part.map(([id, count]) => sql`WHEN ${id} THEN ${count}`)
      const ids = part.map(([id]) => id)
      await this.database
        .update(graphNodesTable)
        .set({
          mentionCount: sql`CASE id ${sql.join(cases, sql` `)} ELSE ${graphNodesTable.mentionCount} END`,
          updatedAt: now
        })
        .where(inArray(graphNodesTable.id, ids))
    }
  }

  async listNodeIds(vaultId: string): Promise<string[]> {
    const rows = await this.database
      .select({ id: graphNodesTable.id })
      .from(graphNodesTable)
      .where(and(eq(graphNodesTable.vaultId, vaultId), isNull(graphNodesTable.deletedAt)))
    return rows.map((r) => r.id)
  }

  async listEdgeIds(vaultId: string): Promise<string[]> {
    const rows = await this.database
      .select({ id: graphEdgesTable.id })
      .from(graphEdgesTable)
      .where(and(eq(graphEdgesTable.vaultId, vaultId), isNull(graphEdgesTable.deletedAt)))
    return rows.map((r) => r.id)
  }

  async listLiveNodeRefs(vaultId: string): Promise<Array<{ id: string; shardMonth: string }>> {
    const rows = await this.database
      .select({ id: graphNodesTable.id, shardMonth: graphNodesTable.shardMonth })
      .from(graphNodesTable)
      .where(and(eq(graphNodesTable.vaultId, vaultId), isNull(graphNodesTable.deletedAt)))
    return rows.map((r) => ({ id: r.id, shardMonth: r.shardMonth ?? '' }))
  }

  async listLiveEdgeRefs(vaultId: string): Promise<Array<{ id: string; shardMonth: string }>> {
    const rows = await this.database
      .select({ id: graphEdgesTable.id, shardMonth: graphEdgesTable.shardMonth })
      .from(graphEdgesTable)
      .where(and(eq(graphEdgesTable.vaultId, vaultId), isNull(graphEdgesTable.deletedAt)))
    return rows.map((r) => ({ id: r.id, shardMonth: r.shardMonth ?? '' }))
  }

  async listPendingEdges(vaultId: string): Promise<GraphEdgeRow[]> {
    const rows = await this.database
      .select()
      .from(graphEdgesTable)
      .where(
        and(
          eq(graphEdgesTable.vaultId, vaultId),
          eq(graphEdgesTable.reviewStatus, 'pending'),
          isNull(graphEdgesTable.deletedAt)
        )
      )
      .orderBy(desc(graphEdgesTable.updatedAt), graphEdgesTable.id)
      .limit(GRAPH_PENDING_LIST_LIMIT)
    return rows.map(mapEdge)
  }

  async listPendingNodes(vaultId: string): Promise<GraphNodeRow[]> {
    const rows = await this.database
      .select()
      .from(graphNodesTable)
      .where(
        and(
          eq(graphNodesTable.vaultId, vaultId),
          eq(graphNodesTable.reviewStatus, 'pending'),
          isNull(graphNodesTable.deletedAt)
        )
      )
      .orderBy(desc(graphNodesTable.updatedAt), graphNodesTable.id)
      .limit(GRAPH_PENDING_LIST_LIMIT)
    return rows.map(mapNode)
  }

  /**
   * Shortest path (BFS) between two nodes, max 2–3 hops.
   * Expands via frontier SQL queries (no full-edge load). Deque uses head index.
   */
  async findShortestPath(
    vaultId: string,
    fromId: string,
    toId: string,
    opts?: {
      maxHops?: 2 | 3
      approvedOnly?: boolean
      hubDegreeThreshold?: number
    }
  ): Promise<GraphPath | null> {
    if (fromId === toId) {
      return { nodeIds: [fromId], edges: [] }
    }
    const maxHops = opts?.maxHops ?? 3
    const approvedOnly = opts?.approvedOnly !== false
    const hubDegreeThreshold = opts?.hubDegreeThreshold ?? 40

    type Prev = { prevId: string; edge: GraphEdgeRow; direction: 'forward' | 'reverse' } | null
    const visited = new Map<string, { hops: number; prev: Prev }>()
    visited.set(fromId, { hops: 0, prev: null })
    let frontier = [fromId]
    const degree = new Map<string, number>()

    for (let hops = 0; hops < maxHops && frontier.length > 0; hops++) {
      if (visited.has(toId) && (visited.get(toId)?.hops ?? 0) <= hops) break
      const expandable = frontier.filter((id) => {
        if (id === toId) return false
        const isHub = id !== fromId && id !== toId && (degree.get(id) ?? 0) > hubDegreeThreshold
        return !isHub
      })
      if (expandable.length === 0) break
      const expandSet = new Set(expandable)
      const edges = await this.selectCurrentEdgesTouching(vaultId, expandable, { approvedOnly })
      const next: string[] = []
      for (const edge of edges) {
        degree.set(edge.fromId, (degree.get(edge.fromId) ?? 0) + 1)
        degree.set(edge.toId, (degree.get(edge.toId) ?? 0) + 1)
        for (const cur of expandable) {
          if (edge.fromId !== cur && edge.toId !== cur) continue
          if (!expandSet.has(cur)) continue
          const neighbor = edge.fromId === cur ? edge.toId : edge.fromId
          if (visited.has(neighbor)) continue
          const curState = visited.get(cur)!
          const direction: 'forward' | 'reverse' =
            edge.fromId === cur && edge.toId === neighbor ? 'forward' : 'reverse'
          visited.set(neighbor, {
            hops: curState.hops + 1,
            prev: { prevId: cur, edge, direction }
          })
          next.push(neighbor)
        }
      }
      frontier = next
    }

    if (!visited.has(toId)) return null

    const nodeIds: string[] = []
    const edges: GraphEdgeRow[] = []
    const edgeDirections: Array<'forward' | 'reverse'> = []
    let cursor: string | null = toId
    while (cursor) {
      nodeIds.push(cursor)
      const state = visited.get(cursor)
      if (!state?.prev) break
      edges.push(state.prev.edge)
      edgeDirections.push(state.prev.direction)
      cursor = state.prev.prevId
    }
    nodeIds.reverse()
    edges.reverse()
    edgeDirections.reverse()
    return { nodeIds, edges, edgeDirections }
  }

  /**
   * Find shortest paths from `fromId` to up to `limit` nearby nodes within maxHops.
   */
  async findPathsFrom(
    vaultId: string,
    fromId: string,
    opts?: {
      maxHops?: 2 | 3
      approvedOnly?: boolean
      limit?: number
      hubDegreeThreshold?: number
    }
  ): Promise<GraphPath[]> {
    const maxHops = opts?.maxHops ?? 3
    const limit = opts?.limit ?? 12
    const approvedOnly = opts?.approvedOnly !== false
    const hubDegreeThreshold = opts?.hubDegreeThreshold ?? 40

    type Prev = { prevId: string; edge: GraphEdgeRow; direction: 'forward' | 'reverse' } | null
    const visited = new Map<string, { hops: number; prev: Prev }>()
    visited.set(fromId, { hops: 0, prev: null })
    let frontier = [fromId]
    const destinations: string[] = []
    const degree = new Map<string, number>()

    for (let hops = 0; hops < maxHops && frontier.length > 0; hops++) {
      const expandable = frontier.filter((id) => {
        const isHub = id !== fromId && (degree.get(id) ?? 0) > hubDegreeThreshold
        return !isHub
      })
      if (expandable.length === 0) break
      const expandSet = new Set(expandable)
      const edges = await this.selectCurrentEdgesTouching(vaultId, expandable, { approvedOnly })
      const next: string[] = []
      for (const edge of edges) {
        degree.set(edge.fromId, (degree.get(edge.fromId) ?? 0) + 1)
        degree.set(edge.toId, (degree.get(edge.toId) ?? 0) + 1)
        for (const cur of expandable) {
          if (edge.fromId !== cur && edge.toId !== cur) continue
          if (!expandSet.has(cur)) continue
          const neighbor = edge.fromId === cur ? edge.toId : edge.fromId
          if (visited.has(neighbor)) continue
          const curState = visited.get(cur)!
          const direction: 'forward' | 'reverse' =
            edge.fromId === cur && edge.toId === neighbor ? 'forward' : 'reverse'
          visited.set(neighbor, {
            hops: curState.hops + 1,
            prev: { prevId: cur, edge, direction }
          })
          next.push(neighbor)
          destinations.push(neighbor)
        }
      }
      frontier = next
    }

    const paths: GraphPath[] = []
    for (const dest of destinations) {
      if (paths.length >= limit) break
      const nodeIds: string[] = []
      const edges: GraphEdgeRow[] = []
      const edgeDirections: Array<'forward' | 'reverse'> = []
      let cursor: string | null = dest
      while (cursor) {
        nodeIds.push(cursor)
        const state = visited.get(cursor)
        if (!state?.prev) break
        edges.push(state.prev.edge)
        edgeDirections.push(state.prev.direction)
        cursor = state.prev.prevId
      }
      nodeIds.reverse()
      edges.reverse()
      edgeDirections.reverse()
      paths.push({ nodeIds, edges, edgeDirections })
    }
    return paths
  }

  /** Apply a collapsed JSONL node row into SQLite (sync path; forceId). */
  async applyRawNode(row: {
    id: string
    vaultId: string
    nodeType: string
    name: string
    aliases: string[]
    summary: string
    props: Record<string, unknown>
    mentionCount: number
    firstSeenAt: number
    lastSeenAt: number
    origin: 'ai' | 'user'
    createdAt: number
    updatedAt: number
    deletedAt: number | null
    reviewStatus?: 'approved' | 'pending' | 'rejected'
    shardMonth?: string
    embedding?: number[] | null
    modelId?: string
  }): Promise<ApplyRawNodeResult> {
    if (row.deletedAt != null) {
      await this.softDeleteNode(row.id)
      return { id: row.id }
    }
    const existingById = await this.getNodeById(row.id, row.vaultId)
    const input = {
      id: row.id,
      forceId: true as const,
      vaultId: row.vaultId,
      nodeType: row.nodeType,
      name: row.name,
      aliases: mergeAliases(existingById?.aliases ?? [], [row.name, ...(row.aliases ?? [])]),
      summary: row.summary || existingById?.summary || '',
      propsJson: JSON.stringify(row.props ?? {}),
      mentionCount: row.mentionCount,
      firstSeenAt: row.firstSeenAt,
      lastSeenAt: row.lastSeenAt,
      origin: row.origin,
      shardMonth: row.shardMonth || existingById?.shardMonth,
      reviewStatus: row.reviewStatus ?? 'approved',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: null,
      embedding: row.embedding,
      modelId: row.modelId
    }
    try {
      await this.upsertNode(input)
      return { id: row.id }
    } catch (error) {
      if (row.nodeType === 'entry' || !isSqliteUniqueConstraintError(error)) throw error
      const existing = await this.findNodeByNameOrAlias(row.vaultId, row.name, row.nodeType)
      if (!existing || existing.id === row.id) throw error
      const keepIncoming = shouldKeepIncomingGraphNodeId({
        vaultId: row.vaultId,
        nodeType: row.nodeType,
        name: row.name,
        incomingId: row.id,
        existingId: existing.id
      })
      const mergedAliases = mergeAliases(existing.aliases, [
        existing.name,
        row.name,
        ...(row.aliases ?? [])
      ])
      if (!keepIncoming) {
        await this.remapEdgeEndpoints(row.vaultId, row.id, existing.id)
        await this.upsertNode({
          ...input,
          id: existing.id,
          aliases: mergedAliases,
          origin: preferGraphOrigin(existing.origin, row.origin),
          shardMonth: existing.shardMonth || input.shardMonth
        })
        return {
          id: existing.id,
          remappedFrom: row.id,
          remappedFromShardMonth: row.shardMonth || existing.shardMonth,
          writeBackSurvivor: true
        }
      }
      await this.remapEdgeEndpoints(row.vaultId, existing.id, row.id)
      await this.softDeleteNode(existing.id, { cascadeEdges: false })
      await this.upsertNode({
        ...input,
        aliases: mergedAliases,
        origin: preferGraphOrigin(existing.origin, row.origin)
      })
      return {
        id: row.id,
        remappedFrom: existing.id,
        remappedFromShardMonth: existing.shardMonth,
        writeBackSurvivor: true
      }
    }
  }

  async applyRawEdge(row: {
    id: string
    vaultId: string
    fromId: string
    toId: string
    edgeType: string
    props: Record<string, unknown>
    validFrom: number | null
    validTo: number | null
    isCurrent: boolean
    sourceKind: string
    sourceRef: string | null
    sourceExcerpt: string
    sourceContentHash: string | null
    confidence: number
    origin: 'ai' | 'user'
    reviewStatus: 'approved' | 'pending' | 'rejected'
    shardMonth: string
    createdAt: number
    updatedAt: number
    deletedAt: number | null
  }): Promise<void> {
    if (row.deletedAt != null) {
      await this.softDeleteEdge(row.id)
      return
    }
    await this.upsertEdge({
      id: row.id,
      vaultId: row.vaultId,
      fromId: row.fromId,
      toId: row.toId,
      edgeType: row.edgeType,
      propsJson: JSON.stringify(row.props ?? {}),
      validFrom: row.validFrom,
      validTo: row.validTo,
      isCurrent: row.isCurrent,
      sourceKind: row.sourceKind,
      sourceRef: row.sourceRef,
      sourceExcerpt: row.sourceExcerpt,
      sourceContentHash: row.sourceContentHash,
      confidence: row.confidence,
      origin: row.origin,
      reviewStatus: row.reviewStatus,
      shardMonth: row.shardMonth,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: null
    })
  }
}
