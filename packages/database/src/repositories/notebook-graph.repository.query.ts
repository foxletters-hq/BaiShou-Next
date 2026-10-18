import { and, desc, eq, inArray, isNull, like, or, sql } from 'drizzle-orm'
import {
  GRAPH_GLOBAL_MAX_NODES,
  GRAPH_SQL_IN_CHUNK,
  graphViewQueryLimit,
  graphViewSqlLimit,
  normalizeGraphName
} from '@baishou/shared'
import {
  notebookGraphAliasesTable,
  notebookGraphEdgesTable,
  notebookGraphNodesTable,
  type NotebookGraphEdgeRow,
  type NotebookGraphNodeRow
} from '../schema/knowledge'
import type { AppDatabase } from '../types'
import type { NotebookGraphPath } from './notebook-graph.ports'
import {
  chunkIds,
  compareDiscriminatorAsc,
  requireNotebookId
} from './notebook-graph.repository.shared'

/** 画布视图不读 embedding blob，避免打开图时把整库向量拷进 IPC。 */
const NOTEBOOK_GRAPH_VIEW_NODE_COLUMNS = {
  id: notebookGraphNodesTable.id,
  vaultId: notebookGraphNodesTable.vaultId,
  notebookId: notebookGraphNodesTable.notebookId,
  nodeType: notebookGraphNodesTable.nodeType,
  name: notebookGraphNodesTable.name,
  nameNormalized: notebookGraphNodesTable.nameNormalized,
  discriminator: notebookGraphNodesTable.discriminator,
  aliases: notebookGraphNodesTable.aliases,
  summary: notebookGraphNodesTable.summary,
  propsJson: notebookGraphNodesTable.propsJson,
  mentionCount: notebookGraphNodesTable.mentionCount,
  firstSeenAt: notebookGraphNodesTable.firstSeenAt,
  lastSeenAt: notebookGraphNodesTable.lastSeenAt,
  origin: notebookGraphNodesTable.origin,
  shardMonth: notebookGraphNodesTable.shardMonth,
  reviewStatus: notebookGraphNodesTable.reviewStatus,
  createdAt: notebookGraphNodesTable.createdAt,
  updatedAt: notebookGraphNodesTable.updatedAt,
  deletedAt: notebookGraphNodesTable.deletedAt
} as const

const NOTEBOOK_GRAPH_VIEW_EDGE_COLUMNS = {
  id: notebookGraphEdgesTable.id,
  vaultId: notebookGraphEdgesTable.vaultId,
  notebookId: notebookGraphEdgesTable.notebookId,
  fromId: notebookGraphEdgesTable.fromId,
  toId: notebookGraphEdgesTable.toId,
  edgeType: notebookGraphEdgesTable.edgeType,
  validFrom: notebookGraphEdgesTable.validFrom,
  validTo: notebookGraphEdgesTable.validTo,
  isCurrent: notebookGraphEdgesTable.isCurrent,
  sourceKind: notebookGraphEdgesTable.sourceKind,
  sourceRef: notebookGraphEdgesTable.sourceRef,
  sourceExcerpt: notebookGraphEdgesTable.sourceExcerpt,
  confidence: notebookGraphEdgesTable.confidence,
  origin: notebookGraphEdgesTable.origin,
  reviewStatus: notebookGraphEdgesTable.reviewStatus,
  shardMonth: notebookGraphEdgesTable.shardMonth,
  createdAt: notebookGraphEdgesTable.createdAt,
  updatedAt: notebookGraphEdgesTable.updatedAt,
  deletedAt: notebookGraphEdgesTable.deletedAt
} as const

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
    const queryLimit = graphViewSqlLimit(opts.maxNodes ?? GRAPH_GLOBAL_MAX_NODES)
    const nodeQuery = this.db
      .select(NOTEBOOK_GRAPH_VIEW_NODE_COLUMNS)
      .from(notebookGraphNodesTable)
      .where(
        and(
          eq(notebookGraphNodesTable.vaultId, vaultId),
          eq(notebookGraphNodesTable.notebookId, notebookId),
          isNull(notebookGraphNodesTable.deletedAt)
        )
      )
      .orderBy(desc(notebookGraphNodesTable.mentionCount), notebookGraphNodesTable.id)
    const nodes = (await nodeQuery.limit(queryLimit)) as NotebookGraphNodeRow[]
    const idSet = new Set(nodes.map((n) => n.id))
    if (idSet.size === 0) return { nodes, edges: [] }
    const edges = await this.getEdgesConnectingNodes(vaultId, notebookId, idSet)
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
    const missingAliasIds = [
      ...new Set(aliasRows.map((hit) => hit.nodeId).filter((nodeId) => !seen.has(nodeId)))
    ]
    for (const part of chunkIds(missingAliasIds)) {
      const rows = await this.db
        .select()
        .from(notebookGraphNodesTable)
        .where(
          and(
            inArray(notebookGraphNodesTable.id, part),
            eq(notebookGraphNodesTable.vaultId, vaultId),
            eq(notebookGraphNodesTable.notebookId, notebookId),
            isNull(notebookGraphNodesTable.deletedAt)
          )
        )
      for (const row of rows) seen.set(row.id, row)
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
    const missingAliasIds = [
      ...new Set(aliases.map((hit) => hit.nodeId).filter((nodeId) => !seen.has(nodeId)))
    ]
    for (const part of chunkIds(missingAliasIds)) {
      const byIdFilters = [
        inArray(notebookGraphNodesTable.id, part),
        eq(notebookGraphNodesTable.notebookId, nb),
        isNull(notebookGraphNodesTable.deletedAt)
      ]
      if (type) byIdFilters.push(eq(notebookGraphNodesTable.nodeType, type))
      const byId = await this.db
        .select()
        .from(notebookGraphNodesTable)
        .where(and(...byIdFilters))
      for (const row of byId) seen.set(row.id, row)
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
    const queryLimit = graphViewQueryLimit(opts.maxNodes ?? 80)
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
    const ids = queryLimit == null ? [...neighborIds] : [...neighborIds].slice(0, queryLimit)
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
      const tips = [...new Set(frontier.map((p) => p.nodes[p.nodes.length - 1]!))]
      if (tips.length === 0) break
      const half = Math.max(50, Math.floor(GRAPH_SQL_IN_CHUNK / 2))
      const edgesByTip = new Map<string, NotebookGraphEdgeRow[]>()
      const seenEdgeIds = new Set<string>()
      for (const tipChunk of chunkIds(tips, half)) {
        const incidentChunk = await this.db
          .select()
          .from(notebookGraphEdgesTable)
          .where(
            and(
              eq(notebookGraphEdgesTable.vaultId, vaultId),
              eq(notebookGraphEdgesTable.notebookId, notebookId),
              eq(notebookGraphEdgesTable.isCurrent, 1),
              isNull(notebookGraphEdgesTable.deletedAt),
              or(
                inArray(notebookGraphEdgesTable.fromId, tipChunk),
                inArray(notebookGraphEdgesTable.toId, tipChunk)
              )
            )
          )
        for (const e of incidentChunk) {
          if (seenEdgeIds.has(e.id)) continue
          seenEdgeIds.add(e.id)
          let fromList = edgesByTip.get(e.fromId)
          if (!fromList) {
            fromList = []
            edgesByTip.set(e.fromId, fromList)
          }
          fromList.push(e)
          if (e.toId !== e.fromId) {
            let toList = edgesByTip.get(e.toId)
            if (!toList) {
              toList = []
              edgesByTip.set(e.toId, toList)
            }
            toList.push(e)
          }
        }
      }
      for (const path of frontier) {
        const tip = path.nodes[path.nodes.length - 1]!
        const neighbors = edgesByTip.get(tip) ?? []
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

  async listNodesPage(opts: {
    vaultId: string
    notebookId: string
    keyword?: string
    limit?: number
    offset?: number
  }): Promise<NotebookGraphNodeRow[]> {
    const notebookId = requireNotebookId(opts.notebookId)
    const vaultId = opts.vaultId.trim()
    if (!vaultId) throw new Error('listNodesPage: vaultId required')
    const conditions = [
      eq(notebookGraphNodesTable.vaultId, vaultId),
      eq(notebookGraphNodesTable.notebookId, notebookId),
      isNull(notebookGraphNodesTable.deletedAt),
      sql`${notebookGraphNodesTable.reviewStatus} != 'rejected'`
    ]
    const q = opts.keyword?.trim()
    if (q) {
      const pattern = `%${q.replace(/%/g, '')}%`
      conditions.push(
        or(
          like(notebookGraphNodesTable.name, pattern),
          like(notebookGraphNodesTable.summary, pattern),
          like(notebookGraphNodesTable.discriminator, pattern),
          like(notebookGraphNodesTable.nodeType, pattern)
        )!
      )
    }
    const limit = Math.max(1, opts.limit ?? 20)
    const offset = Math.max(0, opts.offset ?? 0)
    const rows = await this.db
      .select(NOTEBOOK_GRAPH_VIEW_NODE_COLUMNS)
      .from(notebookGraphNodesTable)
      .where(and(...conditions))
      .orderBy(
        sql`case when ${notebookGraphNodesTable.reviewStatus} = 'pending' then 0 else 1 end`,
        desc(notebookGraphNodesTable.mentionCount),
        notebookGraphNodesTable.name,
        notebookGraphNodesTable.id
      )
      .limit(limit)
      .offset(offset)
    return rows as NotebookGraphNodeRow[]
  }

  async countNodes(opts: {
    vaultId: string
    notebookId: string
    keyword?: string
  }): Promise<number> {
    const notebookId = requireNotebookId(opts.notebookId)
    const vaultId = opts.vaultId.trim()
    if (!vaultId) throw new Error('countNodes: vaultId required')
    const conditions = [
      eq(notebookGraphNodesTable.vaultId, vaultId),
      eq(notebookGraphNodesTable.notebookId, notebookId),
      isNull(notebookGraphNodesTable.deletedAt),
      sql`${notebookGraphNodesTable.reviewStatus} != 'rejected'`
    ]
    const q = opts.keyword?.trim()
    if (q) {
      const pattern = `%${q.replace(/%/g, '')}%`
      conditions.push(
        or(
          like(notebookGraphNodesTable.name, pattern),
          like(notebookGraphNodesTable.summary, pattern),
          like(notebookGraphNodesTable.discriminator, pattern),
          like(notebookGraphNodesTable.nodeType, pattern)
        )!
      )
    }
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(notebookGraphNodesTable)
      .where(and(...conditions))
    return Number(rows[0]?.count ?? 0)
  }

  async countCurrentEdges(opts: { vaultId: string; notebookId: string }): Promise<number> {
    const notebookId = requireNotebookId(opts.notebookId)
    const vaultId = opts.vaultId.trim()
    if (!vaultId) throw new Error('countCurrentEdges: vaultId required')
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(notebookGraphEdgesTable)
      .where(
        and(
          eq(notebookGraphEdgesTable.vaultId, vaultId),
          eq(notebookGraphEdgesTable.notebookId, notebookId),
          eq(notebookGraphEdgesTable.isCurrent, 1),
          isNull(notebookGraphEdgesTable.deletedAt),
          sql`${notebookGraphEdgesTable.reviewStatus} != 'rejected'`
        )
      )
    return Number(rows[0]?.count ?? 0)
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

  private async getEdgesConnectingNodes(
    vaultId: string,
    notebookId: string,
    idSet: Set<string>
  ): Promise<NotebookGraphEdgeRow[]> {
    if (idSet.size === 0) return []
    const idList = [...idSet]
    const half = Math.max(50, Math.floor(GRAPH_SQL_IN_CHUNK / 2))
    const edges: NotebookGraphEdgeRow[] = []
    for (const part of chunkIds(idList, half)) {
      const edgeRows = await this.db
        .select(NOTEBOOK_GRAPH_VIEW_EDGE_COLUMNS)
        .from(notebookGraphEdgesTable)
        .where(
          and(
            eq(notebookGraphEdgesTable.vaultId, vaultId),
            eq(notebookGraphEdgesTable.notebookId, notebookId),
            eq(notebookGraphEdgesTable.isCurrent, 1),
            isNull(notebookGraphEdgesTable.deletedAt),
            inArray(notebookGraphEdgesTable.fromId, part)
          )
        )
      for (const e of edgeRows as NotebookGraphEdgeRow[]) {
        if (idSet.has(e.toId)) edges.push(e)
      }
    }
    return edges
  }
}
