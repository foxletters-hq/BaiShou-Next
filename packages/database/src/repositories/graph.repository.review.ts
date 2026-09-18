import { and, desc, eq, isNull, like } from 'drizzle-orm'
import {
  GRAPH_PENDING_LIST_LIMIT,
  collectGraphEdgeEndpointIds,
  collectSimilarPendingPairs,
  listGraphSimilarPending,
  parseGraphNodePropsRecord,
  type GraphSimilarPendingPair
} from '@baishou/shared'
import { graphEdgesTable, graphNodesTable } from '../schema/graph'
import type { AppDatabase } from '../types'
import type { GraphQueryOps } from './graph.repository.query'
import {
  mapEdge,
  mapNode,
  nodePropsHaveSimilarPending,
  nodePropsHaveSuspectReason
} from './graph.repository.shared'
import type { GraphEdgeRow, GraphNodeRow } from './graph.repository.types'

export class GraphReviewOps {
  constructor(
    private readonly database: AppDatabase,
    private readonly lookup: GraphQueryOps
  ) {}

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

  async listSimilarPendingPairs(vaultId: string): Promise<GraphSimilarPendingPair[]> {
    const rows = await this.database
      .select()
      .from(graphNodesTable)
      .where(
        and(
          eq(graphNodesTable.vaultId, vaultId),
          isNull(graphNodesTable.deletedAt),
          like(graphNodesTable.propsJson, '%"similarPending"%')
        )
      )
      .orderBy(desc(graphNodesTable.updatedAt), graphNodesTable.id)
      .limit(GRAPH_PENDING_LIST_LIMIT)
    const nodes = rows.map(mapNode).filter((row) => nodePropsHaveSimilarPending(row.propsJson))
    const peerIds = [
      ...new Set(
        nodes.flatMap((row) =>
          listGraphSimilarPending(parseGraphNodePropsRecord(row.propsJson)).map(
            (item) => item.peerId
          )
        )
      )
    ]
    const peers = await this.lookup.getNodesByIds(vaultId, peerIds)
    return collectSimilarPendingPairs(
      nodes.map((row) => ({ id: row.id, name: row.name, propsJson: row.propsJson })),
      new Map(peers.map((row) => [row.id, row.name]))
    )
  }

  async listSuspectNodes(vaultId: string): Promise<GraphNodeRow[]> {
    const rows = await this.database
      .select()
      .from(graphNodesTable)
      .where(
        and(
          eq(graphNodesTable.vaultId, vaultId),
          eq(graphNodesTable.reviewStatus, 'pending'),
          isNull(graphNodesTable.deletedAt),
          like(graphNodesTable.propsJson, '%"suspectReason"%')
        )
      )
      .orderBy(desc(graphNodesTable.updatedAt), graphNodesTable.id)
      .limit(GRAPH_PENDING_LIST_LIMIT)
    return rows.map(mapNode).filter((row) => nodePropsHaveSuspectReason(row.propsJson))
  }

  async listLiveScanGraph(vaultId: string): Promise<{
    nodes: Array<{
      id: string
      name: string
      nodeType: string
      discriminator: string
      propsJson: string
    }>
    edges: Array<{
      fromId: string
      toId: string
      edgeType: string
      isCurrent: boolean
      sourceRef: string | null
    }>
  }> {
    const [nodes, edges] = await Promise.all([
      this.database
        .select({
          id: graphNodesTable.id,
          name: graphNodesTable.name,
          nodeType: graphNodesTable.nodeType,
          discriminator: graphNodesTable.discriminator,
          propsJson: graphNodesTable.propsJson
        })
        .from(graphNodesTable)
        .where(and(eq(graphNodesTable.vaultId, vaultId), isNull(graphNodesTable.deletedAt))),
      this.database
        .select({
          fromId: graphEdgesTable.fromId,
          toId: graphEdgesTable.toId,
          edgeType: graphEdgesTable.edgeType,
          isCurrent: graphEdgesTable.isCurrent,
          sourceRef: graphEdgesTable.sourceRef
        })
        .from(graphEdgesTable)
        .where(and(eq(graphEdgesTable.vaultId, vaultId), isNull(graphEdgesTable.deletedAt)))
    ])
    return {
      nodes: nodes.map((row) => ({
        id: row.id,
        name: row.name,
        nodeType: row.nodeType,
        discriminator: row.discriminator ?? '',
        propsJson: row.propsJson ?? '{}'
      })),
      edges: edges.map((row) => ({
        fromId: row.fromId,
        toId: row.toId,
        edgeType: row.edgeType,
        isCurrent: !!row.isCurrent,
        sourceRef: row.sourceRef
      }))
    }
  }

  async listPendingGraph(vaultId: string): Promise<{
    nodes: GraphNodeRow[]
    edges: GraphEdgeRow[]
    endpointNodes: GraphNodeRow[]
  }> {
    const [nodes, edges] = await Promise.all([
      this.listPendingNodes(vaultId),
      this.listPendingEdges(vaultId)
    ])
    const endpointNodes = await this.lookup.getNodesByIds(
      vaultId,
      collectGraphEdgeEndpointIds(edges)
    )
    return { nodes, edges, endpointNodes }
  }
}
