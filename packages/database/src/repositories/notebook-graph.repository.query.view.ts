import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm'
import {
  GRAPH_GLOBAL_MAX_NODES,
  GRAPH_SQL_IN_CHUNK,
  graphViewQueryLimit,
  graphViewSqlLimit
} from '@baishou/shared'
import {
  notebookGraphEdgesTable,
  notebookGraphNodesTable,
  type NotebookGraphEdgeRow,
  type NotebookGraphNodeRow
} from '../schema/knowledge'
import type { AppDatabase } from '../types'
import type { NotebookGraphPath } from './notebook-graph.ports'
import { chunkIds, requireNotebookId } from './notebook-graph.repository.shared'
import {
  NOTEBOOK_GRAPH_VIEW_EDGE_COLUMNS,
  NOTEBOOK_GRAPH_VIEW_NODE_COLUMNS
} from './notebook-graph.repository.query.columns'

/** 画布、邻域与最短路径等图视图读取。 */
export class NotebookGraphViewOps {
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
