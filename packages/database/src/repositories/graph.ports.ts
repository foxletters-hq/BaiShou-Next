import type {
  GraphEdgeRow,
  GraphNodeRow,
  GraphPath,
  UpsertEdgeInput,
  UpsertNodeInput
} from './graph.repository'

/** Name / id lookup only — extract, chat, find-or-create. */
export interface GraphNodeLookup {
  findNodeByNameOrAlias(
    vaultId: string,
    name: string,
    type?: string
  ): Promise<GraphNodeRow | null>
  getNodeById(id: string, vaultId?: string): Promise<GraphNodeRow | null>
}

/** Read / traverse — RAG and UI. */
export interface GraphQuery extends GraphNodeLookup {
  getEdgeById(id: string, vaultId?: string): Promise<GraphEdgeRow | null>
  searchNodesByName(
    vaultId: string,
    query: string,
    opts?: { nodeTypes?: string[]; limit?: number }
  ): Promise<GraphNodeRow[]>
  searchNodesByVector(
    vaultId: string,
    vector: number[],
    topK: number,
    opts?: { nodeType?: string; modelId?: string }
  ): Promise<Array<GraphNodeRow & { distance: number }>>
  traverse(
    vaultId: string,
    centerId: string,
    depth: 1 | 2 | 3,
    opts?: { approvedOnly?: boolean }
  ): Promise<{ nodes: GraphNodeRow[]; edges: GraphEdgeRow[] }>
  listEntityTimeline(
    vaultId: string,
    nodeId: string,
    opts?: { approvedOnly?: boolean; limit?: number }
  ): Promise<{ nodes: GraphNodeRow[]; edges: GraphEdgeRow[] }>
  getGlobalGraph(opts: {
    vaultId: string
    maxNodes?: number
    minMentionCount?: number
    nodeTypes?: string[]
    monthRange?: { startMonth: string; endMonth: string }
  }): Promise<{ nodes: GraphNodeRow[]; edges: GraphEdgeRow[] }>
  findShortestPath(
    vaultId: string,
    fromId: string,
    toId: string,
    opts?: { maxHops?: 2 | 3; approvedOnly?: boolean; hubDegreeThreshold?: number }
  ): Promise<GraphPath | null>
  findPathsFrom(
    vaultId: string,
    fromId: string,
    opts?: { maxHops?: 2 | 3; approvedOnly?: boolean; limit?: number; hubDegreeThreshold?: number }
  ): Promise<GraphPath[]>
}

/** Explicit writes — IPC / review, not JSONL sync. */
export interface GraphWrite {
  upsertNode(input: UpsertNodeInput): Promise<string>
  upsertEdge(input: UpsertEdgeInput): Promise<string>
  /** Removes the node row and, by default, incident edges. */
  softDeleteNode(id: string): Promise<void>
  /** Removes the edge row. */
  softDeleteEdge(id: string): Promise<void>
  supersedeEdge(edgeId: string, validTo: number): Promise<void>
  supersedeEdgesBySourceRef(
    vaultId: string,
    sourceRef: string,
    opts?: { keepUserOrigin?: boolean; exceptIds?: ReadonlySet<string> }
  ): Promise<void>
}

/** Review queue listing — not a write, not RAG. */
export interface GraphReview {
  listPendingNodes(vaultId: string): Promise<GraphNodeRow[]>
  listPendingEdges(vaultId: string): Promise<GraphEdgeRow[]>
}

/** pending-index apply + orphan sweep. */
export interface GraphSyncApply {
  getNodeById(id: string, vaultId?: string): Promise<GraphNodeRow | null>
  applyRawNode(row: {
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
  }): Promise<import('./graph.repository').ApplyRawNodeResult | void>
  applyRawEdge(row: {
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
  }): Promise<void>
  softDeleteNode(id: string): Promise<void>
  softDeleteEdge(id: string): Promise<void>
  listNodeIds(vaultId: string): Promise<string[]>
  listEdgeIds(vaultId: string): Promise<string[]>
  listLiveNodeRefs(vaultId: string): Promise<Array<{ id: string; shardMonth: string }>>
  listLiveEdgeRefs(vaultId: string): Promise<Array<{ id: string; shardMonth: string }>>
}

/** Diary extract commit — lookup + vector align + mention recount. */
export interface GraphExtractStore extends GraphNodeLookup {
  listEdgesTouching?(vaultId: string, nodeId: string): Promise<GraphEdgeRow[]>
  searchNodesByVector(
    vaultId: string,
    vector: number[],
    topK: number,
    opts?: { nodeType?: string; modelId?: string }
  ): Promise<Array<GraphNodeRow & { distance: number }>>
  recountMentions(vaultId: string, nodeIds?: string[]): Promise<void>
}

export interface GraphRepositoryPort
  extends GraphQuery, GraphWrite, GraphReview, GraphSyncApply, GraphExtractStore {}
