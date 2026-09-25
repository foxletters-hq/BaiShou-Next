import { and, desc, eq, inArray, isNull, like, or } from 'drizzle-orm'
import { GRAPH_GLOBAL_MAX_NODES, GRAPH_SQL_IN_CHUNK, normalizeGraphName } from '@baishou/shared'
import {
  notebookGraphAliasesTable,
  notebookGraphEdgesTable,
  notebookGraphNodesTable,
  type NotebookGraphEdgeRow,
  type NotebookGraphNodeRow
} from '../schema/knowledge'
import type { AppDatabase } from '../types'
import type { NotebookGraphPath } from './notebook-graph.ports'
import { compareDiscriminatorAsc, requireNotebookId } from './notebook-graph.repository.shared'

export class NotebookGraphQueryOps {
  constructor(private readonly db: AppDatabase) {}

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

  async listEdgesTouching(
    vaultId: string,
    notebookId: string,
    nodeId: string
  ): Promise<NotebookGraphEdgeRow[]> {
    const nb = requireNotebookId(notebookId)
    const vid = vaultId.trim()
    const id = nodeId.trim()
    if (!vid || !id) return []
    return this.db
      .select()
      .from(notebookGraphEdgesTable)
      .where(
        and(
          eq(notebookGraphEdgesTable.vaultId, vid),
          eq(notebookGraphEdgesTable.notebookId, nb),
          isNull(notebookGraphEdgesTable.deletedAt),
          or(eq(notebookGraphEdgesTable.fromId, id), eq(notebookGraphEdgesTable.toId, id))
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

  async findNodesByNameOrAlias(
    vaultId: string,
    notebookId: string,
    name: string,
    nodeType?: string
  ): Promise<NotebookGraphNodeRow[]> {
    const nb = requireNotebookId(notebookId)
    const norm = normalizeGraphName(name)
    if (!norm) return []
    const type = nodeType?.trim().toLowerCase() || ''
    const filters = [
      eq(notebookGraphNodesTable.vaultId, vaultId.trim()),
      eq(notebookGraphNodesTable.notebookId, nb),
      eq(notebookGraphNodesTable.nameNormalized, norm),
      isNull(notebookGraphNodesTable.deletedAt)
    ]
    if (type) filters.push(eq(notebookGraphNodesTable.nodeType, type))
    const byName = await this.db
      .select()
      .from(notebookGraphNodesTable)
      .where(and(...filters))
    const seen = new Map<string, NotebookGraphNodeRow>()
    for (const row of byName) seen.set(row.id, row)

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
    for (const hit of aliases) {
      if (seen.has(hit.nodeId)) continue
      const byIdFilters = [
        eq(notebookGraphNodesTable.id, hit.nodeId),
        eq(notebookGraphNodesTable.notebookId, nb),
        isNull(notebookGraphNodesTable.deletedAt)
      ]
      if (type) byIdFilters.push(eq(notebookGraphNodesTable.nodeType, type))
      const byId = await this.db
        .select()
        .from(notebookGraphNodesTable)
        .where(and(...byIdFilters))
        .limit(1)
      if (byId[0]) seen.set(byId[0].id, byId[0])
    }

    return [...seen.values()].sort((a, b) =>
      compareDiscriminatorAsc(a.discriminator ?? '', b.discriminator ?? '')
    )
  }

  async findNodeByName(
    vaultId: string,
    notebookId: string,
    name: string,
    nodeType?: string
  ): Promise<NotebookGraphNodeRow | null> {
    const nodes = await this.findNodesByNameOrAlias(vaultId, notebookId, name, nodeType)
    const type = nodeType?.trim()
    if (type) return nodes[0] ?? null
    // 未指定类型时跨类型多命中仍闭口，避免把「苹果人」和「苹果主题」合成一条
    const types = new Set(nodes.map((row) => row.nodeType))
    if (types.size !== 1) return null
    return nodes[0] ?? null
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
          or(eq(notebookGraphEdgesTable.fromId, nodeId), eq(notebookGraphEdgesTable.toId, nodeId))
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
              or(eq(notebookGraphEdgesTable.fromId, tip), eq(notebookGraphEdgesTable.toId, tip))
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
