import { and, desc, eq, inArray, isNull, like, or } from 'drizzle-orm'
import {
  GRAPH_GLOBAL_MAX_NODES,
  GRAPH_SQL_IN_CHUNK,
  normalizeGraphEdgeReviewFields,
  normalizeGraphName,
  shouldKeepIncomingNotebookGraphNodeId
} from '@baishou/shared'
import type { ApplyRawNodeResult } from './graph.repository'
import { isSqliteUniqueConstraintError } from '../utils/sqlite-function-error.util'
import type { AppDatabase } from '../types'
import {
  notebookGraphAliasesTable,
  notebookGraphEdgesTable,
  notebookGraphNodesTable,
  type NotebookGraphEdgeRow,
  type NotebookGraphNodeRow
} from '../schema/knowledge'
import type { NotebookGraphPath, NotebookGraphRepositoryPort } from './notebook-graph.ports'

function requireNotebookId(notebookId: string): string {
  const id = notebookId.trim()
  if (!id) throw new Error('notebook graph requires notebookId')
  return id
}

function mergeNotebookAliases(existingRaw: string | string[] | undefined, extra: string[]): string[] {
  let existing: string[] = []
  if (Array.isArray(existingRaw)) existing = existingRaw
  else if (typeof existingRaw === 'string' && existingRaw.trim()) {
    try {
      const parsed = JSON.parse(existingRaw) as unknown
      if (Array.isArray(parsed)) existing = parsed.filter((x): x is string => typeof x === 'string')
    } catch {
      existing = []
    }
  }
  const out = new Set<string>()
  for (const a of [...existing, ...extra]) {
    const n = a.trim()
    if (n) out.add(n)
  }
  return [...out]
}

export class NotebookGraphRepository implements NotebookGraphRepositoryPort {
  constructor(private readonly db: AppDatabase) {}

  async applyRawNode(row: {
    id: string
    vaultId: string
    notebookId: string
    nodeType: string
    name: string
    aliases?: string[]
    summary?: string
    props?: Record<string, unknown>
    mentionCount?: number
    firstSeenAt?: number
    lastSeenAt?: number
    origin?: string
    shardMonth?: string
    reviewStatus?: string
    createdAt: number
    updatedAt: number
    deletedAt?: number | null
  }): Promise<ApplyRawNodeResult> {
    const notebookId = requireNotebookId(row.notebookId)
    const vaultId = row.vaultId.trim()
    if (!vaultId) throw new Error('applyRawNode: vaultId required')
    if (row.deletedAt != null) {
      await this.softDeleteNode(row.id, notebookId)
      return { id: row.id }
    }
    const now = Date.now()
    const existingById = await this.getNodeById(row.id, vaultId, notebookId)
    const aliases = mergeNotebookAliases(existingById?.aliases, [row.name, ...(row.aliases ?? [])])
    try {
      await this.db
        .insert(notebookGraphNodesTable)
        .values({
          id: row.id,
          vaultId,
          notebookId,
          nodeType: row.nodeType,
          name: row.name,
          nameNormalized: normalizeGraphName(row.name),
          aliases: JSON.stringify(aliases),
          summary: row.summary || existingById?.summary || '',
          propsJson: JSON.stringify(row.props ?? {}),
          mentionCount: row.mentionCount ?? 0,
          firstSeenAt: row.firstSeenAt ?? now,
          lastSeenAt: row.lastSeenAt ?? now,
          origin: row.origin ?? existingById?.origin ?? 'ai',
          shardMonth: row.shardMonth || existingById?.shardMonth || '',
          reviewStatus: row.reviewStatus ?? existingById?.reviewStatus ?? 'approved',
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          deletedAt: null
        })
        .onConflictDoUpdate({
          target: [notebookGraphNodesTable.id],
          set: {
            vaultId,
            notebookId,
            nodeType: row.nodeType,
            name: row.name,
            nameNormalized: normalizeGraphName(row.name),
            aliases: JSON.stringify(aliases),
            summary: row.summary || existingById?.summary || '',
            propsJson: JSON.stringify(row.props ?? {}),
            mentionCount: row.mentionCount ?? 0,
            lastSeenAt: row.lastSeenAt ?? now,
            origin: row.origin ?? existingById?.origin ?? 'ai',
            shardMonth: row.shardMonth || existingById?.shardMonth || '',
            reviewStatus: row.reviewStatus ?? existingById?.reviewStatus ?? 'approved',
            updatedAt: row.updatedAt,
            deletedAt: null
          }
        })
      await this.replaceAliases(vaultId, notebookId, row.id, aliases)
      return { id: row.id }
    } catch (error) {
      if (row.nodeType === 'source' || !isSqliteUniqueConstraintError(error)) throw error
      const existing = await this.findNodeByName(vaultId, notebookId, row.name, row.nodeType)
      if (!existing || existing.id === row.id) throw error
      const keepIncoming = shouldKeepIncomingNotebookGraphNodeId({
        vaultId,
        notebookId,
        nodeType: row.nodeType,
        name: row.name,
        incomingId: row.id,
        existingId: existing.id
      })
      const mergedAliases = mergeNotebookAliases(existing.aliases, [
        existing.name,
        row.name,
        ...aliases
      ])
      if (!keepIncoming) {
        await this.remapEdgeEndpoints(vaultId, notebookId, row.id, existing.id)
        await this.db
          .update(notebookGraphNodesTable)
          .set({
            aliases: JSON.stringify(mergedAliases),
            summary: row.summary || existing.summary || '',
            mentionCount: Math.max(row.mentionCount ?? 0, existing.mentionCount ?? 0),
            lastSeenAt: row.lastSeenAt ?? now,
            updatedAt: row.updatedAt,
            deletedAt: null
          })
          .where(
            and(
              eq(notebookGraphNodesTable.id, existing.id),
              eq(notebookGraphNodesTable.notebookId, notebookId)
            )
          )
        await this.replaceAliases(vaultId, notebookId, existing.id, mergedAliases)
        return {
          id: existing.id,
          remappedFrom: row.id,
          remappedFromShardMonth: row.shardMonth || existing.shardMonth,
          writeBackSurvivor: true
        }
      }
      await this.remapEdgeEndpoints(vaultId, notebookId, existing.id, row.id)
      await this.softDeleteNode(existing.id, notebookId, { cascadeEdges: false })
      await this.db
        .insert(notebookGraphNodesTable)
        .values({
          id: row.id,
          vaultId,
          notebookId,
          nodeType: row.nodeType,
          name: row.name,
          nameNormalized: normalizeGraphName(row.name),
          aliases: JSON.stringify(mergedAliases),
          summary: row.summary || existing.summary || '',
          propsJson: JSON.stringify(row.props ?? {}),
          mentionCount: Math.max(row.mentionCount ?? 0, existing.mentionCount ?? 0),
          firstSeenAt: Math.min(row.firstSeenAt ?? now, existing.firstSeenAt ?? now),
          lastSeenAt: row.lastSeenAt ?? now,
          origin: row.origin ?? existing.origin ?? 'ai',
          shardMonth: row.shardMonth || existing.shardMonth || '',
          reviewStatus: row.reviewStatus ?? existing.reviewStatus ?? 'approved',
          createdAt: existing.createdAt ?? row.createdAt,
          updatedAt: row.updatedAt,
          deletedAt: null
        })
        .onConflictDoUpdate({
          target: [notebookGraphNodesTable.id],
          set: {
            name: row.name,
            nameNormalized: normalizeGraphName(row.name),
            aliases: JSON.stringify(mergedAliases),
            summary: row.summary || existing.summary || '',
            updatedAt: row.updatedAt,
            deletedAt: null
          }
        })
      await this.replaceAliases(vaultId, notebookId, row.id, mergedAliases)
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
    notebookId: string
    fromId: string
    toId: string
    edgeType: string
    props?: Record<string, unknown>
    validFrom?: number | null
    validTo?: number | null
    isCurrent?: boolean
    sourceKind?: string
    sourceRef?: string | null
    sourceExcerpt?: string
    sourceContentHash?: string | null
    confidence?: number
    origin?: string
    reviewStatus?: string
    shardMonth: string
    createdAt: number
    updatedAt: number
    deletedAt?: number | null
  }): Promise<void> {
    const notebookId = requireNotebookId(row.notebookId)
    const vaultId = row.vaultId.trim()
    if (!vaultId) throw new Error('applyRawEdge: vaultId required')
    if (row.deletedAt != null) {
      await this.softDeleteEdge(row.id, notebookId)
      return
    }
    const review = normalizeGraphEdgeReviewFields({
      confidence: row.confidence,
      reviewStatus: row.reviewStatus,
      fallbackConfidence: 100
    })
    await this.db
      .insert(notebookGraphEdgesTable)
      .values({
        id: row.id,
        vaultId,
        notebookId,
        fromId: row.fromId,
        toId: row.toId,
        edgeType: row.edgeType,
        propsJson: JSON.stringify(row.props ?? {}),
        validFrom: row.validFrom ?? null,
        validTo: row.validTo ?? null,
        isCurrent: row.isCurrent === false ? 0 : 1,
        sourceKind: row.sourceKind ?? 'knowledge',
        sourceRef: row.sourceRef ?? null,
        sourceExcerpt: row.sourceExcerpt ?? '',
        sourceContentHash: row.sourceContentHash ?? null,
        confidence: review.confidence,
        origin: row.origin ?? 'ai',
        reviewStatus: review.reviewStatus,
        shardMonth: row.shardMonth,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: null
      })
      .onConflictDoUpdate({
        target: [notebookGraphEdgesTable.id],
        set: {
          vaultId,
          notebookId,
          fromId: row.fromId,
          toId: row.toId,
          edgeType: row.edgeType,
          propsJson: JSON.stringify(row.props ?? {}),
          validFrom: row.validFrom ?? null,
          validTo: row.validTo ?? null,
          isCurrent: row.isCurrent === false ? 0 : 1,
          sourceKind: row.sourceKind ?? 'knowledge',
          sourceRef: row.sourceRef ?? null,
          sourceExcerpt: row.sourceExcerpt ?? '',
          sourceContentHash: row.sourceContentHash ?? null,
          confidence: review.confidence,
          origin: row.origin ?? 'ai',
          reviewStatus: review.reviewStatus,
          shardMonth: row.shardMonth,
          updatedAt: row.updatedAt,
          deletedAt: null
        }
      })
  }

  async softDeleteNode(
    id: string,
    notebookId: string,
    opts?: { cascadeEdges?: boolean }
  ): Promise<void> {
    const nb = requireNotebookId(notebookId)
    if (opts?.cascadeEdges !== false) {
      await this.db
        .delete(notebookGraphEdgesTable)
        .where(
          and(
            eq(notebookGraphEdgesTable.notebookId, nb),
            or(eq(notebookGraphEdgesTable.fromId, id), eq(notebookGraphEdgesTable.toId, id))
          )
        )
    }
    await this.db.delete(notebookGraphAliasesTable).where(eq(notebookGraphAliasesTable.nodeId, id))
    await this.db
      .delete(notebookGraphNodesTable)
      .where(and(eq(notebookGraphNodesTable.id, id), eq(notebookGraphNodesTable.notebookId, nb)))
  }

  async remapEdgeEndpoints(
    vaultId: string,
    notebookId: string,
    fromId: string,
    toId: string
  ): Promise<void> {
    if (!fromId || !toId || fromId === toId) return
    const nb = requireNotebookId(notebookId)
    const now = Date.now()
    await this.db
      .update(notebookGraphEdgesTable)
      .set({ fromId: toId, updatedAt: now })
      .where(
        and(
          eq(notebookGraphEdgesTable.vaultId, vaultId),
          eq(notebookGraphEdgesTable.notebookId, nb),
          eq(notebookGraphEdgesTable.fromId, fromId),
          isNull(notebookGraphEdgesTable.deletedAt)
        )
      )
    await this.db
      .update(notebookGraphEdgesTable)
      .set({ toId: toId, updatedAt: now })
      .where(
        and(
          eq(notebookGraphEdgesTable.vaultId, vaultId),
          eq(notebookGraphEdgesTable.notebookId, nb),
          eq(notebookGraphEdgesTable.toId, fromId),
          isNull(notebookGraphEdgesTable.deletedAt)
        )
      )
  }

  async softDeleteEdge(id: string, notebookId: string): Promise<void> {
    const nb = requireNotebookId(notebookId)
    await this.db
      .delete(notebookGraphEdgesTable)
      .where(and(eq(notebookGraphEdgesTable.id, id), eq(notebookGraphEdgesTable.notebookId, nb)))
  }

  async getView(opts: {
    vaultId: string
    notebookId: string
    maxNodes?: number
  }): Promise<{ nodes: NotebookGraphNodeRow[]; edges: NotebookGraphEdgeRow[] }> {
    const notebookId = requireNotebookId(opts.notebookId)
    const vaultId = opts.vaultId.trim()
    if (!vaultId) throw new Error('getView: vaultId required')
    const maxNodes = Math.max(1, opts.maxNodes ?? GRAPH_GLOBAL_MAX_NODES)
    const nodes = await this.db
      .select()
      .from(notebookGraphNodesTable)
      .where(
        and(
          eq(notebookGraphNodesTable.vaultId, vaultId),
          eq(notebookGraphNodesTable.notebookId, notebookId),
          isNull(notebookGraphNodesTable.deletedAt)
        )
      )
      .orderBy(desc(notebookGraphNodesTable.mentionCount), notebookGraphNodesTable.id)
      .limit(maxNodes)
    const idSet = new Set(nodes.map((n) => n.id))
    if (idSet.size === 0) return { nodes, edges: [] }
    const edges: NotebookGraphEdgeRow[] = []
    const ids = [...idSet]
    for (let i = 0; i < ids.length; i += GRAPH_SQL_IN_CHUNK) {
      const part = ids.slice(i, i + GRAPH_SQL_IN_CHUNK)
      const rows = await this.db
        .select()
        .from(notebookGraphEdgesTable)
        .where(
          and(
            eq(notebookGraphEdgesTable.vaultId, vaultId),
            eq(notebookGraphEdgesTable.notebookId, notebookId),
            eq(notebookGraphEdgesTable.isCurrent, 1),
            isNull(notebookGraphEdgesTable.deletedAt),
            or(
              inArray(notebookGraphEdgesTable.fromId, part),
              inArray(notebookGraphEdgesTable.toId, part)
            )
          )
        )
      for (const e of rows) {
        if (idSet.has(e.fromId) && idSet.has(e.toId)) edges.push(e)
      }
    }
    return { nodes, edges }
  }

  async searchNodes(opts: {
    vaultId: string
    notebookId: string
    query: string
    limit?: number
  }): Promise<NotebookGraphNodeRow[]> {
    const notebookId = requireNotebookId(opts.notebookId)
    const vaultId = opts.vaultId.trim()
    if (!vaultId) throw new Error('searchNodes: vaultId required')
    const q = opts.query.trim()
    if (!q) return []
    const likeQ = `%${q.replace(/%/g, '')}%`
    const norm = normalizeGraphName(q)
    const limit = Math.max(1, opts.limit ?? 12)
    const byName = await this.db
      .select()
      .from(notebookGraphNodesTable)
      .where(
        and(
          eq(notebookGraphNodesTable.vaultId, vaultId),
          eq(notebookGraphNodesTable.notebookId, notebookId),
          isNull(notebookGraphNodesTable.deletedAt),
          or(
            like(notebookGraphNodesTable.name, likeQ),
            eq(notebookGraphNodesTable.nameNormalized, norm)
          )
        )
      )
      .orderBy(desc(notebookGraphNodesTable.mentionCount), notebookGraphNodesTable.id)
      .limit(limit)
    const aliasRows = await this.db
      .select({ nodeId: notebookGraphAliasesTable.nodeId })
      .from(notebookGraphAliasesTable)
      .where(
        and(
          eq(notebookGraphAliasesTable.vaultId, vaultId),
          eq(notebookGraphAliasesTable.notebookId, notebookId),
          or(
            eq(notebookGraphAliasesTable.aliasNormalized, norm),
            like(notebookGraphAliasesTable.aliasNormalized, likeQ)
          )
        )
      )
      .limit(limit)
    const seen = new Map<string, (typeof byName)[number]>()
    for (const row of byName) seen.set(row.id, row)
    for (const hit of aliasRows) {
      if (seen.has(hit.nodeId)) continue
      const rows = await this.db
        .select()
        .from(notebookGraphNodesTable)
        .where(
          and(
            eq(notebookGraphNodesTable.id, hit.nodeId),
            eq(notebookGraphNodesTable.vaultId, vaultId),
            eq(notebookGraphNodesTable.notebookId, notebookId),
            isNull(notebookGraphNodesTable.deletedAt)
          )
        )
        .limit(1)
      if (rows[0]) seen.set(rows[0].id, rows[0])
    }
    return [...seen.values()]
      .sort((a, b) => b.mentionCount - a.mentionCount || a.id.localeCompare(b.id))
      .slice(0, limit)
  }

  async getEdgeById(
    id: string,
    vaultId: string,
    notebookId: string
  ): Promise<NotebookGraphEdgeRow | null> {
    const nb = requireNotebookId(notebookId)
    const rows = await this.db
      .select()
      .from(notebookGraphEdgesTable)
      .where(
        and(
          eq(notebookGraphEdgesTable.id, id),
          eq(notebookGraphEdgesTable.vaultId, vaultId.trim()),
          eq(notebookGraphEdgesTable.notebookId, nb),
          isNull(notebookGraphEdgesTable.deletedAt)
        )
      )
      .limit(1)
    return rows[0] ?? null
  }

  async listPendingNodes(vaultId: string, notebookId: string): Promise<NotebookGraphNodeRow[]> {
    const nb = requireNotebookId(notebookId)
    return this.db
      .select()
      .from(notebookGraphNodesTable)
      .where(
        and(
          eq(notebookGraphNodesTable.vaultId, vaultId.trim()),
          eq(notebookGraphNodesTable.notebookId, nb),
          eq(notebookGraphNodesTable.reviewStatus, 'pending'),
          isNull(notebookGraphNodesTable.deletedAt)
        )
      )
  }

  async listPendingEdges(vaultId: string, notebookId: string): Promise<NotebookGraphEdgeRow[]> {
    const nb = requireNotebookId(notebookId)
    return this.db
      .select()
      .from(notebookGraphEdgesTable)
      .where(
        and(
          eq(notebookGraphEdgesTable.vaultId, vaultId.trim()),
          eq(notebookGraphEdgesTable.notebookId, nb),
          eq(notebookGraphEdgesTable.reviewStatus, 'pending'),
          isNull(notebookGraphEdgesTable.deletedAt)
        )
      )
  }

  async getNodeById(
    id: string,
    vaultId: string,
    notebookId: string
  ): Promise<NotebookGraphNodeRow | null> {
    const nb = requireNotebookId(notebookId)
    const rows = await this.db
      .select()
      .from(notebookGraphNodesTable)
      .where(
        and(
          eq(notebookGraphNodesTable.id, id),
          eq(notebookGraphNodesTable.vaultId, vaultId.trim()),
          eq(notebookGraphNodesTable.notebookId, nb),
          isNull(notebookGraphNodesTable.deletedAt)
        )
      )
      .limit(1)
    return rows[0] ?? null
  }

  async findNodeByName(
    vaultId: string,
    notebookId: string,
    name: string,
    nodeType?: string
  ): Promise<NotebookGraphNodeRow | null> {
    const nb = requireNotebookId(notebookId)
    const norm = normalizeGraphName(name)
    if (!norm) return null
    const type = nodeType?.trim().toLowerCase() || ''
    const filters = [
      eq(notebookGraphNodesTable.vaultId, vaultId.trim()),
      eq(notebookGraphNodesTable.notebookId, nb),
      eq(notebookGraphNodesTable.nameNormalized, norm),
      isNull(notebookGraphNodesTable.deletedAt)
    ]
    if (type) filters.push(eq(notebookGraphNodesTable.nodeType, type))
    const rows = await this.db
      .select()
      .from(notebookGraphNodesTable)
      .where(and(...filters))
      .limit(2)
    if (rows.length > 1) return null
    if (rows[0]) return rows[0]
    const aliases = await this.db
      .select({ nodeId: notebookGraphAliasesTable.nodeId })
      .from(notebookGraphAliasesTable)
      .where(
        and(
          eq(notebookGraphAliasesTable.vaultId, vaultId.trim()),
          eq(notebookGraphAliasesTable.notebookId, nb),
          eq(notebookGraphAliasesTable.aliasNormalized, norm)
        )
      )
      .limit(2)
    if (aliases.length !== 1) return null
    const byIdFilters = [
      eq(notebookGraphNodesTable.id, aliases[0]!.nodeId),
      eq(notebookGraphNodesTable.notebookId, nb),
      isNull(notebookGraphNodesTable.deletedAt)
    ]
    if (type) byIdFilters.push(eq(notebookGraphNodesTable.nodeType, type))
    const byId = await this.db
      .select()
      .from(notebookGraphNodesTable)
      .where(and(...byIdFilters))
      .limit(1)
    return byId[0] ?? null
  }

  async getNeighborhood(opts: {
    vaultId: string
    notebookId: string
    nodeId: string
    maxNodes?: number
  }): Promise<{ nodes: NotebookGraphNodeRow[]; edges: NotebookGraphEdgeRow[] }> {
    const notebookId = requireNotebookId(opts.notebookId)
    const vaultId = opts.vaultId.trim()
    if (!vaultId) throw new Error('getNeighborhood: vaultId required')
    const nodeId = opts.nodeId.trim()
    if (!nodeId) return { nodes: [], edges: [] }
    const maxNodes = Math.max(1, opts.maxNodes ?? 80)
    const center = await this.db
      .select()
      .from(notebookGraphNodesTable)
      .where(
        and(
          eq(notebookGraphNodesTable.id, nodeId),
          eq(notebookGraphNodesTable.vaultId, vaultId),
          eq(notebookGraphNodesTable.notebookId, notebookId),
          isNull(notebookGraphNodesTable.deletedAt)
        )
      )
      .limit(1)
    if (!center[0]) return { nodes: [], edges: [] }

    const edges = await this.db
      .select()
      .from(notebookGraphEdgesTable)
      .where(
        and(
          eq(notebookGraphEdgesTable.vaultId, vaultId),
          eq(notebookGraphEdgesTable.notebookId, notebookId),
          eq(notebookGraphEdgesTable.isCurrent, 1),
          isNull(notebookGraphEdgesTable.deletedAt),
          or(
            eq(notebookGraphEdgesTable.fromId, nodeId),
            eq(notebookGraphEdgesTable.toId, nodeId)
          )
        )
      )

    const neighborIds = new Set<string>([nodeId])
    for (const edge of edges) {
      neighborIds.add(edge.fromId)
      neighborIds.add(edge.toId)
    }
    const ids = [...neighborIds].slice(0, maxNodes)
    const nodes = await this.db
      .select()
      .from(notebookGraphNodesTable)
      .where(
        and(
          eq(notebookGraphNodesTable.vaultId, vaultId),
          eq(notebookGraphNodesTable.notebookId, notebookId),
          inArray(notebookGraphNodesTable.id, ids),
          isNull(notebookGraphNodesTable.deletedAt)
        )
      )
    const idSet = new Set(nodes.map((n) => n.id))
    return {
      nodes,
      edges: edges.filter((e) => idSet.has(e.fromId) && idSet.has(e.toId))
    }
  }

  async findShortestPath(opts: {
    vaultId: string
    notebookId: string
    fromId: string
    toId: string
    maxHops?: number
  }): Promise<NotebookGraphPath | null> {
    const notebookId = requireNotebookId(opts.notebookId)
    const vaultId = opts.vaultId.trim()
    const maxHops = Math.min(3, Math.max(1, opts.maxHops ?? 3))
    if (opts.fromId === opts.toId) return { nodeIds: [opts.fromId], edges: [] }

    type Frontier = { nodes: string[]; edgeIds: string[] }
    let frontier: Frontier[] = [{ nodes: [opts.fromId], edgeIds: [] }]
    const seen = new Set<string>([opts.fromId])

    for (let hop = 0; hop < maxHops; hop++) {
      const next: Frontier[] = []
      for (const path of frontier) {
        const tip = path.nodes[path.nodes.length - 1]!
        const neighbors = await this.db
          .select()
          .from(notebookGraphEdgesTable)
          .where(
            and(
              eq(notebookGraphEdgesTable.vaultId, vaultId),
              eq(notebookGraphEdgesTable.notebookId, notebookId),
              eq(notebookGraphEdgesTable.isCurrent, 1),
              isNull(notebookGraphEdgesTable.deletedAt),
              or(
                eq(notebookGraphEdgesTable.fromId, tip),
                eq(notebookGraphEdgesTable.toId, tip)
              )
            )
          )
        for (const e of neighbors) {
          const other = e.fromId === tip ? e.toId : e.fromId
          if (seen.has(other) && other !== opts.toId) continue
          const nodes = [...path.nodes, other]
          const edgeIds = [...path.edgeIds, e.id]
          if (other === opts.toId) {
            const edges = await this.edgesByIds(vaultId, notebookId, edgeIds)
            return { nodeIds: nodes, edges }
          }
          seen.add(other)
          next.push({ nodes, edgeIds })
        }
      }
      frontier = next
      if (frontier.length === 0) break
    }
    return null
  }

  async listLiveIds(opts: { vaultId: string; notebookId: string }): Promise<{
    nodeIds: string[]
    edgeIds: string[]
    nodes: Array<{ id: string; shardMonth: string }>
    edges: Array<{ id: string; shardMonth: string }>
  }> {
    const notebookId = requireNotebookId(opts.notebookId)
    const vaultId = opts.vaultId.trim()
    const nodes = await this.db
      .select({ id: notebookGraphNodesTable.id, shardMonth: notebookGraphNodesTable.shardMonth })
      .from(notebookGraphNodesTable)
      .where(
        and(
          eq(notebookGraphNodesTable.vaultId, vaultId),
          eq(notebookGraphNodesTable.notebookId, notebookId),
          isNull(notebookGraphNodesTable.deletedAt)
        )
      )
    const edges = await this.db
      .select({ id: notebookGraphEdgesTable.id, shardMonth: notebookGraphEdgesTable.shardMonth })
      .from(notebookGraphEdgesTable)
      .where(
        and(
          eq(notebookGraphEdgesTable.vaultId, vaultId),
          eq(notebookGraphEdgesTable.notebookId, notebookId),
          isNull(notebookGraphEdgesTable.deletedAt)
        )
      )
    const nodeRefs = nodes.map((n) => ({ id: n.id, shardMonth: n.shardMonth ?? '' }))
    const edgeRefs = edges.map((e) => ({ id: e.id, shardMonth: e.shardMonth ?? '' }))
    return {
      nodeIds: nodeRefs.map((n) => n.id),
      edgeIds: edgeRefs.map((e) => e.id),
      nodes: nodeRefs,
      edges: edgeRefs
    }
  }

  async supersedeAiEdgesBySourcePrefix(opts: {
    notebookId: string
    sourceRefPrefix: string
    exceptIds: Set<string>
  }): Promise<number> {
    const notebookId = requireNotebookId(opts.notebookId)
    const prefix = opts.sourceRefPrefix.trim()
    if (!prefix) return 0
    const rows = await this.db
      .select({ id: notebookGraphEdgesTable.id, origin: notebookGraphEdgesTable.origin })
      .from(notebookGraphEdgesTable)
      .where(
        and(
          eq(notebookGraphEdgesTable.notebookId, notebookId),
          eq(notebookGraphEdgesTable.origin, 'ai'),
          isNull(notebookGraphEdgesTable.deletedAt),
          like(notebookGraphEdgesTable.sourceRef, `${prefix.replace(/%/g, '')}%`)
        )
      )
    let n = 0
    for (const row of rows) {
      if (opts.exceptIds.has(row.id)) continue
      await this.softDeleteEdge(row.id, notebookId)
      n += 1
    }
    return n
  }

  async deleteAllForNotebook(notebookId: string): Promise<void> {
    const nb = requireNotebookId(notebookId)
    await this.db.delete(notebookGraphAliasesTable).where(eq(notebookGraphAliasesTable.notebookId, nb))
    await this.db.delete(notebookGraphEdgesTable).where(eq(notebookGraphEdgesTable.notebookId, nb))
    await this.db.delete(notebookGraphNodesTable).where(eq(notebookGraphNodesTable.notebookId, nb))
  }

  async deleteAllForVault(vaultId: string): Promise<void> {
    const id = vaultId.trim()
    if (!id) throw new Error('deleteAllForVault: vaultId is required')
    await this.db.delete(notebookGraphAliasesTable).where(eq(notebookGraphAliasesTable.vaultId, id))
    await this.db.delete(notebookGraphEdgesTable).where(eq(notebookGraphEdgesTable.vaultId, id))
    await this.db.delete(notebookGraphNodesTable).where(eq(notebookGraphNodesTable.vaultId, id))
  }

  async deleteEdgesBySourcePrefix(notebookId: string, sourceId: string): Promise<void> {
    const nb = requireNotebookId(notebookId)
    const prefix = sourceId.trim()
    if (!prefix) return
    await this.db
      .delete(notebookGraphEdgesTable)
      .where(
        and(
          eq(notebookGraphEdgesTable.notebookId, nb),
          like(notebookGraphEdgesTable.sourceRef, `${prefix.replace(/%/g, '')}%`)
        )
      )
  }

  private async replaceAliases(
    vaultId: string,
    notebookId: string,
    nodeId: string,
    aliases: string[]
  ): Promise<void> {
    await this.db
      .delete(notebookGraphAliasesTable)
      .where(eq(notebookGraphAliasesTable.nodeId, nodeId))
    const seen = new Set<string>()
    for (const alias of aliases) {
      const norm = normalizeGraphName(alias)
      if (!norm || seen.has(norm)) continue
      seen.add(norm)
      await this.db.insert(notebookGraphAliasesTable).values({
        id: `${nodeId}:${norm}`,
        vaultId,
        notebookId,
        nodeId,
        aliasNormalized: norm
      })
    }
  }

  private async edgesByIds(
    vaultId: string,
    notebookId: string,
    ids: string[]
  ): Promise<NotebookGraphEdgeRow[]> {
    if (ids.length === 0) return []
    return this.db
      .select()
      .from(notebookGraphEdgesTable)
      .where(
        and(
          eq(notebookGraphEdgesTable.vaultId, vaultId),
          eq(notebookGraphEdgesTable.notebookId, notebookId),
          inArray(notebookGraphEdgesTable.id, ids)
        )
      )
  }
}
