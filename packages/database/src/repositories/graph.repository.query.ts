import { and, desc, eq, gte, inArray, isNull, like, lte, ne, or, sql } from 'drizzle-orm'
import {
  GRAPH_PENDING_LIST_LIMIT,
  GRAPH_SQL_IN_CHUNK,
  normalizeGraphName,
  uniqueNonEmptyIds
} from '@baishou/shared'
import {
  graphEdgesTable,
  graphNodeAliasesTable,
  graphNodesTable,
  type GraphNodeType
} from '../schema/graph'
import type { AppDatabase } from '../types'
import {
  chunkIds,
  compareDiscriminatorAsc,
  mapEdge,
  mapNode,
  selectGraphNodesByIds
} from './graph.repository.shared'
import type { GraphEdgeRow, GraphNodeRow } from './graph.repository.types'

export class GraphQueryOps {
  constructor(private readonly database: AppDatabase) {}

  async findNodesByNameOrAlias(
    vaultId: string,
    name: string,
    type?: GraphNodeType | string
  ): Promise<GraphNodeRow[]> {
    const normalized = normalizeGraphName(name)
    if (!normalized) return []
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

    const seen = new Map<string, GraphNodeRow>()
    for (const row of byName) seen.set(row.id, mapNode(row))

    const aliasHits = await this.database
      .select({ nodeId: graphNodeAliasesTable.nodeId })
      .from(graphNodeAliasesTable)
      .where(
        and(
          eq(graphNodeAliasesTable.vaultId, vaultId),
          eq(graphNodeAliasesTable.aliasNormalized, normalized)
        )
      )
    for (const hit of aliasHits) {
      if (seen.has(hit.nodeId)) continue
      const node = await this.getNodeById(hit.nodeId, vaultId)
      if (!node) continue
      if (typed && node.nodeType !== typed) continue
      seen.set(node.id, node)
    }

    return [...seen.values()].sort((a, b) =>
      compareDiscriminatorAsc(a.discriminator, b.discriminator)
    )
  }

  async findNodeByNameOrAlias(
    vaultId: string,
    name: string,
    type?: GraphNodeType | string
  ): Promise<GraphNodeRow | null> {
    const nodes = await this.findNodesByNameOrAlias(vaultId, name, type)
    const typed = type?.trim()
    if (typed) return nodes[0] ?? null
    // 未指定类型时跨类型多命中仍闭口，避免把「苹果人」和「苹果主题」合成一条
    const types = new Set(nodes.map((row) => row.nodeType))
    if (types.size !== 1) return null
    return nodes[0] ?? null
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
          or(
            eq(graphNodeAliasesTable.aliasNormalized, norm),
            like(graphNodeAliasesTable.aliasNormalized, pattern)
          )
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
    return [...seen.values()].sort((a, b) => b.mentionCount - a.mentionCount).slice(0, limit)
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
      let nodes = await selectGraphNodesByIds(this.database, opts.vaultId, rankedIds)
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
        let extra = await selectGraphNodesByIds(this.database, opts.vaultId, pendingMissingIds)
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

  async getNodesByIds(vaultId: string, ids: string[]): Promise<GraphNodeRow[]> {
    const unique = uniqueNonEmptyIds(ids)
    if (unique.length === 0) return []
    const out: GraphNodeRow[] = []
    for (const part of chunkIds(unique)) {
      const rows = await this.database
        .select()
        .from(graphNodesTable)
        .where(
          and(
            eq(graphNodesTable.vaultId, vaultId),
            isNull(graphNodesTable.deletedAt),
            inArray(graphNodesTable.id, part)
          )
        )
      out.push(...rows.map(mapNode))
    }
    return out
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
}
