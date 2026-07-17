import { and, eq, isNull, like, or, desc, inArray } from 'drizzle-orm'
import {
  graphEdgesTable,
  graphNodesTable,
  type GraphEdgeType,
  type GraphNodeType
} from '../schema/graph'
import type { AppDatabase } from '../types'

const VECTOR_REUSE_DISTANCE = 0.15

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

function parseAliases(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function serializeVector(vector: number[]): Buffer {
  return Buffer.from(new Float32Array(vector).buffer)
}

function ms(date: Date | null | undefined): number | null {
  if (!date) return null
  return date.getTime()
}

export interface GraphNodeRow {
  id: string
  vaultName: string
  nodeType: string
  name: string
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
  vaultName: string
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

export interface UpsertNodeInput {
  id?: string
  vaultName: string
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
  vaultName: string
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

function mapNode(row: typeof graphNodesTable.$inferSelect): GraphNodeRow {
  return {
    id: row.id,
    vaultName: row.vaultName,
    nodeType: row.nodeType,
    name: row.name,
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
    vaultName: row.vaultName,
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

/**
 * SQLite-only graph repository. Does not write Graph/ JSONL files.
 */
export class GraphRepository {
  constructor(private readonly database: AppDatabase) {}

  async findNodeByNameOrAlias(
    vaultName: string,
    name: string,
    type: GraphNodeType | string
  ): Promise<GraphNodeRow | null> {
    const normalized = normalizeName(name)
    if (!normalized) return null
    const rows = await this.database
      .select()
      .from(graphNodesTable)
      .where(
        and(
          eq(graphNodesTable.vaultName, vaultName),
          eq(graphNodesTable.nodeType, type),
          isNull(graphNodesTable.deletedAt)
        )
      )
    const lower = normalized.toLowerCase()
    for (const row of rows) {
      if (normalizeName(row.name).toLowerCase() === lower) return mapNode(row)
      const aliases = parseAliases(row.aliases)
      if (aliases.some((a) => normalizeName(a).toLowerCase() === lower)) return mapNode(row)
    }
    return null
  }

  async searchNodesByVector(
    vaultName: string,
    vector: number[],
    topK: number,
    opts?: { nodeType?: string; modelId?: string }
  ): Promise<Array<GraphNodeRow & { distance: number }>> {
    const filters = [
      eq(graphNodesTable.vaultName, vaultName),
      isNull(graphNodesTable.deletedAt),
      ...(opts?.nodeType ? [eq(graphNodesTable.nodeType, opts.nodeType)] : [])
    ]
    const rows = await this.database
      .select()
      .from(graphNodesTable)
      .where(and(...filters))
    const query = new Float32Array(vector)
    const scored: Array<GraphNodeRow & { distance: number }> = []
    for (const row of rows) {
      if (!row.embedding || !row.dimension || row.dimension !== query.length) continue
      if (opts?.modelId && row.modelId && row.modelId !== opts.modelId) continue
      const buf = row.embedding as Buffer
      const emb = new Float32Array(buf.buffer, buf.byteOffset, row.dimension)
      const distance = cosineDistance(query, emb)
      scored.push({ ...mapNode(row), distance })
    }
    scored.sort((a, b) => a.distance - b.distance)
    return scored.slice(0, topK)
  }

  async searchNodesByName(
    vaultName: string,
    query: string,
    opts?: { nodeTypes?: Array<GraphNodeType | string>; limit?: number }
  ): Promise<GraphNodeRow[]> {
    const q = query.trim()
    if (!q) return []
    const limit = opts?.limit ?? 20
    const pattern = `%${q}%`
    const rows = await this.database
      .select()
      .from(graphNodesTable)
      .where(
        and(
          eq(graphNodesTable.vaultName, vaultName),
          isNull(graphNodesTable.deletedAt),
          or(like(graphNodesTable.name, pattern), like(graphNodesTable.aliases, pattern))
        )
      )
      .orderBy(desc(graphNodesTable.mentionCount))
      .limit(limit * 3)
    let mapped = rows.map(mapNode)
    if (opts?.nodeTypes?.length) {
      const allow = new Set(opts.nodeTypes)
      mapped = mapped.filter((n) => allow.has(n.nodeType))
    }
    return mapped.slice(0, limit)
  }

  /**
   * Disambiguation: exact name/alias → vector threshold 0.15 → create.
   * When forceId + id provided, upsert that row without reuse.
   */
  async upsertNode(input: UpsertNodeInput): Promise<string> {
    const now = Date.now()
    const name = normalizeName(input.name)
    const updatedAt = input.updatedAt ?? now
    const createdAt = input.createdAt ?? now

    if (!input.forceId) {
      const existing = await this.findNodeByNameOrAlias(input.vaultName, name, input.nodeType)
      if (existing) {
        await this.touchNode(existing.id, {
          aliases: mergeAliases(existing.aliases, input.aliases ?? [name]),
          lastSeenAt: input.lastSeenAt ?? now,
          mentionCount: existing.mentionCount + 1,
          summary: input.summary ?? existing.summary,
          embedding: input.embedding,
          modelId: input.modelId,
          updatedAt
        })
        return existing.id
      }
      if (input.embedding?.length) {
        const hits = await this.searchNodesByVector(input.vaultName, input.embedding, 1, {
          nodeType: input.nodeType,
          modelId: input.modelId
        })
        const top = hits[0]
        if (top && top.distance < VECTOR_REUSE_DISTANCE) {
          await this.touchNode(top.id, {
            aliases: mergeAliases(top.aliases, [name, ...(input.aliases ?? [])]),
            lastSeenAt: input.lastSeenAt ?? now,
            mentionCount: top.mentionCount + 1,
            summary: input.summary ?? top.summary,
            embedding: input.embedding,
            modelId: input.modelId,
            updatedAt
          })
          return top.id
        }
      }
    }

    const id =
      input.id ??
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `n_${Date.now()}_${Math.random().toString(16).slice(2)}`)

    const aliases = JSON.stringify(mergeAliases([], input.aliases ?? [name]))
    const embeddingBuf = input.embedding?.length ? serializeVector(input.embedding) : null
    const values = {
      id,
      vaultName: input.vaultName,
      nodeType: input.nodeType,
      name,
      aliases,
      summary: input.summary ?? '',
      propsJson: input.propsJson ?? '{}',
      embedding: embeddingBuf,
      dimension: input.embedding?.length ?? null,
      modelId: input.modelId ?? '',
      mentionCount: input.mentionCount ?? 1,
      firstSeenAt: input.firstSeenAt != null ? new Date(input.firstSeenAt) : new Date(createdAt),
      lastSeenAt: input.lastSeenAt != null ? new Date(input.lastSeenAt) : new Date(updatedAt),
      origin: input.origin ?? 'ai',
      shardMonth: input.shardMonth ?? '',
      reviewStatus: input.reviewStatus ?? 'approved',
      createdAt: new Date(createdAt),
      updatedAt: new Date(updatedAt),
      deletedAt: input.deletedAt != null ? new Date(input.deletedAt) : null
    }

    await this.database
      .insert(graphNodesTable)
      .values(values)
      .onConflictDoUpdate({
        target: [graphNodesTable.id],
        set: {
          name: values.name,
          aliases: values.aliases,
          summary: values.summary,
          propsJson: values.propsJson,
          embedding: values.embedding,
          dimension: values.dimension,
          modelId: values.modelId,
          mentionCount: values.mentionCount,
          lastSeenAt: values.lastSeenAt,
          origin: values.origin,
          shardMonth: values.shardMonth,
          reviewStatus: values.reviewStatus,
          updatedAt: values.updatedAt,
          deletedAt: values.deletedAt
        }
      })
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
    if (patch.embedding?.length) {
      set.embedding = serializeVector(patch.embedding)
      set.dimension = patch.embedding.length
      if (patch.modelId) set.modelId = patch.modelId
    }
    await this.database.update(graphNodesTable).set(set).where(eq(graphNodesTable.id, id))
  }

  async upsertEdge(input: UpsertEdgeInput): Promise<string> {
    const now = Date.now()
    const createdAt = input.createdAt ?? now
    const updatedAt = input.updatedAt ?? now
    const values = {
      id: input.id,
      vaultName: input.vaultName,
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
      confidence: input.confidence ?? 100,
      origin: input.origin ?? 'ai',
      reviewStatus: input.reviewStatus ?? 'approved',
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
    vaultName: string,
    sourceRef: string,
    opts?: { keepUserOrigin?: boolean }
  ): Promise<void> {
    const now = Date.now()
    const rows = await this.database
      .select()
      .from(graphEdgesTable)
      .where(
        and(
          eq(graphEdgesTable.vaultName, vaultName),
          eq(graphEdgesTable.sourceRef, sourceRef),
          eq(graphEdgesTable.isCurrent, true),
          isNull(graphEdgesTable.deletedAt)
        )
      )
    for (const row of rows) {
      if (opts?.keepUserOrigin && row.origin === 'user') continue
      await this.supersedeEdge(row.id, now)
    }
  }

  async traverse(
    vaultName: string,
    centerId: string,
    depth: 1 | 2,
    opts?: { approvedOnly?: boolean }
  ): Promise<{ nodes: GraphNodeRow[]; edges: GraphEdgeRow[] }> {
    const approvedOnly = opts?.approvedOnly === true
    const nodeIds = new Set<string>([centerId])
    const edgeRows: GraphEdgeRow[] = []
    let frontier = [centerId]
    for (let d = 0; d < depth; d++) {
      if (frontier.length === 0) break
      const edges = await this.database
        .select()
        .from(graphEdgesTable)
        .where(
          and(
            eq(graphEdgesTable.vaultName, vaultName),
            eq(graphEdgesTable.isCurrent, true),
            isNull(graphEdgesTable.deletedAt),
            or(inArray(graphEdgesTable.fromId, frontier), inArray(graphEdgesTable.toId, frontier))
          )
        )
      const next: string[] = []
      for (const e of edges) {
        if (approvedOnly && e.reviewStatus === 'pending') continue
        if (approvedOnly && e.reviewStatus === 'rejected') continue
        edgeRows.push(mapEdge(e))
        for (const id of [e.fromId, e.toId]) {
          if (!nodeIds.has(id)) {
            nodeIds.add(id)
            next.push(id)
          }
        }
      }
      frontier = next
    }
    const ids = [...nodeIds]
    if (ids.length === 0) return { nodes: [], edges: edgeRows }
    let nodes = (
      await this.database
        .select()
        .from(graphNodesTable)
        .where(and(inArray(graphNodesTable.id, ids), isNull(graphNodesTable.deletedAt)))
    ).map(mapNode)
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
    vaultName: string,
    nodeId: string,
    opts?: { approvedOnly?: boolean; limit?: number }
  ): Promise<{ nodes: GraphNodeRow[]; edges: GraphEdgeRow[] }> {
    const approvedOnly = opts?.approvedOnly !== false
    const limit = opts?.limit ?? 80
    const rows = await this.database
      .select()
      .from(graphEdgesTable)
      .where(
        and(
          eq(graphEdgesTable.vaultName, vaultName),
          isNull(graphEdgesTable.deletedAt),
          or(eq(graphEdgesTable.fromId, nodeId), eq(graphEdgesTable.toId, nodeId))
        )
      )
    let edges = rows.map(mapEdge)
    if (approvedOnly) {
      edges = edges.filter((e) => e.reviewStatus !== 'pending' && e.reviewStatus !== 'rejected')
    }
    edges.sort((a, b) => {
      const av = a.validFrom ?? a.createdAt
      const bv = b.validFrom ?? b.createdAt
      return av - bv
    })
    edges = edges.slice(0, limit)
    const idSet = new Set<string>([nodeId])
    for (const e of edges) {
      idSet.add(e.fromId)
      idSet.add(e.toId)
    }
    let nodes = (
      await this.database
        .select()
        .from(graphNodesTable)
        .where(and(inArray(graphNodesTable.id, [...idSet]), isNull(graphNodesTable.deletedAt)))
    ).map(mapNode)
    if (approvedOnly) {
      nodes = nodes.filter((n) => n.reviewStatus !== 'pending' && n.reviewStatus !== 'rejected')
    }
    return { nodes, edges }
  }

  async getGlobalGraph(opts: {
    vaultName: string
    maxNodes?: number
    minMentionCount?: number
    nodeTypes?: Array<GraphNodeType | string>
  }): Promise<{ nodes: GraphNodeRow[]; edges: GraphEdgeRow[] }> {
    const maxNodes = opts.maxNodes ?? 200
    const minMention = opts.minMentionCount ?? 0
    let nodes = (
      await this.database
        .select()
        .from(graphNodesTable)
        .where(
          and(eq(graphNodesTable.vaultName, opts.vaultName), isNull(graphNodesTable.deletedAt))
        )
        .orderBy(desc(graphNodesTable.mentionCount))
        .limit(maxNodes)
    ).map(mapNode)
    if (minMention > 0) nodes = nodes.filter((n) => n.mentionCount >= minMention)
    if (opts.nodeTypes?.length) {
      const allow = new Set(opts.nodeTypes)
      nodes = nodes.filter((n) => allow.has(n.nodeType))
    }
    const idSet = new Set(nodes.map((n) => n.id))
    const edges = (
      await this.database
        .select()
        .from(graphEdgesTable)
        .where(
          and(
            eq(graphEdgesTable.vaultName, opts.vaultName),
            eq(graphEdgesTable.isCurrent, true),
            isNull(graphEdgesTable.deletedAt)
          )
        )
    )
      .map(mapEdge)
      .filter((e) => idSet.has(e.fromId) && idSet.has(e.toId))
    return { nodes, edges }
  }

  async getNodeById(id: string): Promise<GraphNodeRow | null> {
    const rows = await this.database
      .select()
      .from(graphNodesTable)
      .where(and(eq(graphNodesTable.id, id), isNull(graphNodesTable.deletedAt)))
      .limit(1)
    return rows[0] ? mapNode(rows[0]) : null
  }

  async getEdgeById(id: string): Promise<GraphEdgeRow | null> {
    const rows = await this.database
      .select()
      .from(graphEdgesTable)
      .where(and(eq(graphEdgesTable.id, id), isNull(graphEdgesTable.deletedAt)))
      .limit(1)
    return rows[0] ? mapEdge(rows[0]) : null
  }

  async softDeleteNode(id: string): Promise<void> {
    const now = new Date()
    await this.database
      .update(graphNodesTable)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(graphNodesTable.id, id))
  }

  async softDeleteEdge(id: string): Promise<void> {
    const now = new Date()
    await this.database
      .update(graphEdgesTable)
      .set({ deletedAt: now, updatedAt: now, isCurrent: false })
      .where(eq(graphEdgesTable.id, id))
  }

  async listNodeIds(vaultName: string): Promise<string[]> {
    const rows = await this.database
      .select({ id: graphNodesTable.id })
      .from(graphNodesTable)
      .where(and(eq(graphNodesTable.vaultName, vaultName), isNull(graphNodesTable.deletedAt)))
    return rows.map((r) => r.id)
  }

  async listEdgeIds(vaultName: string): Promise<string[]> {
    const rows = await this.database
      .select({ id: graphEdgesTable.id })
      .from(graphEdgesTable)
      .where(and(eq(graphEdgesTable.vaultName, vaultName), isNull(graphEdgesTable.deletedAt)))
    return rows.map((r) => r.id)
  }

  /** All live node ids across vaults (for orphan sweep after pending-index). */
  async listAllLiveNodeIds(): Promise<string[]> {
    const rows = await this.database
      .select({ id: graphNodesTable.id })
      .from(graphNodesTable)
      .where(isNull(graphNodesTable.deletedAt))
    return rows.map((r) => r.id)
  }

  /** All live edge ids across vaults (for orphan sweep after pending-index). */
  async listAllLiveEdgeIds(): Promise<string[]> {
    const rows = await this.database
      .select({ id: graphEdgesTable.id })
      .from(graphEdgesTable)
      .where(isNull(graphEdgesTable.deletedAt))
    return rows.map((r) => r.id)
  }

  async listPendingEdges(vaultName: string): Promise<GraphEdgeRow[]> {
    const rows = await this.database
      .select()
      .from(graphEdgesTable)
      .where(
        and(
          eq(graphEdgesTable.vaultName, vaultName),
          eq(graphEdgesTable.reviewStatus, 'pending'),
          isNull(graphEdgesTable.deletedAt)
        )
      )
    return rows.map(mapEdge)
  }

  /** Apply a collapsed JSONL node row into SQLite (sync path; forceId). */
  async applyRawNode(row: {
    id: string
    vaultName: string
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
  }): Promise<void> {
    if (row.deletedAt != null) {
      await this.softDeleteNode(row.id)
      return
    }
    await this.upsertNode({
      id: row.id,
      forceId: true,
      vaultName: row.vaultName,
      nodeType: row.nodeType,
      name: row.name,
      aliases: row.aliases,
      summary: row.summary,
      propsJson: JSON.stringify(row.props ?? {}),
      mentionCount: row.mentionCount,
      firstSeenAt: row.firstSeenAt,
      lastSeenAt: row.lastSeenAt,
      origin: row.origin,
      shardMonth: row.shardMonth,
      reviewStatus: row.reviewStatus ?? 'approved',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: null,
      embedding: row.embedding,
      modelId: row.modelId
    })
  }

  async applyRawEdge(row: {
    id: string
    vaultName: string
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
      vaultName: row.vaultName,
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

function mergeAliases(existing: string[], extra: string[]): string[] {
  const set = new Set<string>()
  for (const a of [...existing, ...extra]) {
    const n = normalizeName(a)
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
