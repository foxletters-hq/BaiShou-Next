import { and, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import { isMissingSqliteFunctionError } from '../utils/sqlite-function-error.util'
import { graphEdgesTable, graphNodesTable } from '../schema/graph'
import type { AppDatabase } from '../types'
import {
  chunkIds,
  mapEdge,
  selectCurrentGraphEdgesTouching,
  selectGraphNodesByIds,
  serializeVector
} from './graph.repository.shared'
import type { GraphEdgeRow, GraphNodeRow, GraphPath } from './graph.repository.types'

export class GraphTraverseOps {
  constructor(private readonly database: AppDatabase) {}

  async traverse(
    vaultId: string,
    centerId: string,
    depth: 1 | 2 | 3,
    opts?: {
      approvedOnly?: boolean
      queryVector?: number[]
      resolveQueryVector?: () => Promise<number[] | null | undefined>
      maxNeighborsPerHop?: number
    }
  ): Promise<{ nodes: GraphNodeRow[]; edges: GraphEdgeRow[] }> {
    const approvedOnly = opts?.approvedOnly === true
    const hops = Math.min(3, Math.max(1, Math.floor(depth))) as 1 | 2 | 3
    // Omit the cap to keep canvas expand complete; GraphRAG passes GRAPH_MAX_NEIGHBORS_PER_HOP.
    const maxNeighborsPerHop = opts?.maxNeighborsPerHop ?? Number.POSITIVE_INFINITY
    const nodeIds = new Set<string>([centerId])
    const neighborOrder: string[] = []
    const edgeIds = new Set<string>()
    const edgeRows: GraphEdgeRow[] = []
    let frontier = [centerId]
    let cachedQueryVector = opts?.queryVector
    let resolveQueryVectorTried = false
    let didPrune = false

    const ensureQueryVector = async (): Promise<number[] | undefined> => {
      if (cachedQueryVector?.length) return cachedQueryVector
      if (resolveQueryVectorTried) return cachedQueryVector
      resolveQueryVectorTried = true
      if (!opts?.resolveQueryVector) return cachedQueryVector
      const resolved = await opts.resolveQueryVector()
      if (resolved?.length) cachedQueryVector = resolved
      return cachedQueryVector
    }

    for (let d = 0; d < hops; d++) {
      if (frontier.length === 0) break
      const edges = await selectCurrentGraphEdgesTouching(this.database, vaultId, frontier, {
        approvedOnly
      })
      const candidateIds: string[] = []
      const seenCandidate = new Set<string>()
      for (const e of edges) {
        for (const id of [e.fromId, e.toId]) {
          if (id === centerId || nodeIds.has(id) || seenCandidate.has(id)) continue
          seenCandidate.add(id)
          candidateIds.push(id)
        }
      }

      let keepNew = seenCandidate
      if (candidateIds.length > maxNeighborsPerHop) {
        didPrune = true
        const queryVector = await ensureQueryVector()
        const kept = await this.selectPrunedNeighborIds(
          vaultId,
          candidateIds,
          maxNeighborsPerHop,
          queryVector
        )
        keepNew = new Set(kept)
        neighborOrder.push(...kept)
      } else {
        neighborOrder.push(...candidateIds)
      }

      const next: string[] = []
      for (const e of edges) {
        const fromKept = e.fromId === centerId || nodeIds.has(e.fromId) || keepNew.has(e.fromId)
        const toKept = e.toId === centerId || nodeIds.has(e.toId) || keepNew.has(e.toId)
        if (!fromKept || !toKept) continue
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
    let nodes = await selectGraphNodesByIds(this.database, vaultId, [...nodeIds])
    if (approvedOnly) {
      nodes = nodes.filter((n) => n.reviewStatus !== 'pending' && n.reviewStatus !== 'rejected')
    }
    if (didPrune) {
      const rank = new Map<string, number>()
      neighborOrder.forEach((id, i) => {
        if (!rank.has(id)) rank.set(id, i)
      })
      nodes.sort((a, b) => {
        if (a.id === centerId) return -1
        if (b.id === centerId) return 1
        return (
          (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER)
        )
      })
    }
    return { nodes, edges: edgeRows }
  }

  /**
   * Rank candidate neighbor ids to `limit` without materializing embedding blobs in JS.
   * Vector compare stays inside SQLite; missing sqlite-vec falls back to mention_count.
   */
  private async selectPrunedNeighborIds(
    vaultId: string,
    candidateIds: string[],
    limit: number,
    queryVector?: number[]
  ): Promise<string[]> {
    if (candidateIds.length === 0 || limit <= 0) return []
    if (queryVector?.length) {
      try {
        let ranked = await this.selectNeighborIdsByVector(vaultId, candidateIds, queryVector, limit)
        if (ranked.length < limit) {
          const have = new Set(ranked)
          const rest = candidateIds.filter((id) => !have.has(id))
          ranked = ranked.concat(
            await this.selectNeighborIdsByMention(vaultId, rest, limit - ranked.length)
          )
        }
        console.info(
          `[GraphRepository] traverse prune: vec_distance_cosine kept ${ranked.length}/${candidateIds.length}`
        )
        return ranked
      } catch (e) {
        if (!isMissingSqliteFunctionError(e)) throw e
        console.warn(
          `[GraphRepository] traverse prune: sqlite-vec unavailable, ranking by mention_count (${candidateIds.length} candidates)`
        )
      }
    } else {
      console.info(
        `[GraphRepository] traverse prune: mention_count kept ${Math.min(limit, candidateIds.length)}/${candidateIds.length}`
      )
    }
    return this.selectNeighborIdsByMention(vaultId, candidateIds, limit)
  }

  private async selectNeighborIdsByVector(
    vaultId: string,
    candidateIds: string[],
    queryVector: number[],
    limit: number
  ): Promise<string[]> {
    const buf = serializeVector(queryVector)
    const merged: Array<{ id: string; distance: number }> = []
    for (const part of chunkIds(candidateIds)) {
      const rows = await this.database
        .select({
          id: graphNodesTable.id,
          distance: sql<number>`vec_distance_cosine(${graphNodesTable.embedding}, ${buf})`.as(
            'distance'
          )
        })
        .from(graphNodesTable)
        .where(
          and(
            eq(graphNodesTable.vaultId, vaultId),
            isNull(graphNodesTable.deletedAt),
            inArray(graphNodesTable.id, part),
            sql`${graphNodesTable.embedding} is not null`,
            eq(graphNodesTable.dimension, queryVector.length)
          )
        )
        .orderBy(sql`vec_distance_cosine(${graphNodesTable.embedding}, ${buf}) ASC`)
        .limit(limit)
      for (const row of rows) merged.push({ id: row.id, distance: Number(row.distance) })
    }
    merged.sort((a, b) => a.distance - b.distance)
    const seen = new Set<string>()
    const out: string[] = []
    for (const row of merged) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      out.push(row.id)
      if (out.length >= limit) break
    }
    return out
  }

  private async selectNeighborIdsByMention(
    vaultId: string,
    candidateIds: string[],
    limit: number
  ): Promise<string[]> {
    const merged: Array<{ id: string; mentionCount: number }> = []
    for (const part of chunkIds(candidateIds)) {
      const rows = await this.database
        .select({
          id: graphNodesTable.id,
          mentionCount: graphNodesTable.mentionCount
        })
        .from(graphNodesTable)
        .where(
          and(
            eq(graphNodesTable.vaultId, vaultId),
            isNull(graphNodesTable.deletedAt),
            inArray(graphNodesTable.id, part)
          )
        )
        .orderBy(desc(graphNodesTable.mentionCount))
        .limit(limit)
      merged.push(...rows)
    }
    merged.sort((a, b) => b.mentionCount - a.mentionCount)
    const seen = new Set<string>()
    const out: string[] = []
    for (const row of merged) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      out.push(row.id)
      if (out.length >= limit) break
    }
    return out
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
      ? and(
          ne(graphEdgesTable.reviewStatus, 'pending'),
          ne(graphEdgesTable.reviewStatus, 'rejected')
        )
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
    let nodes = await selectGraphNodesByIds(this.database, vaultId, [...idSet])
    if (approvedOnly) {
      nodes = nodes.filter((n) => n.reviewStatus !== 'pending' && n.reviewStatus !== 'rejected')
    }
    return { nodes, edges }
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
      const edges = await selectCurrentGraphEdgesTouching(this.database, vaultId, expandable, {
        approvedOnly
      })
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
      const edges = await selectCurrentGraphEdgesTouching(this.database, vaultId, expandable, {
        approvedOnly
      })
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
}
