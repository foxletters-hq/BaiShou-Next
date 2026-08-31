import type { NotebookGraphEdgeRow, NotebookGraphNodeRow } from '../schema/knowledge'
import type { ApplyRawNodeResult } from './graph.repository'

export interface NotebookGraphPath {
  nodeIds: string[]
  edges: NotebookGraphEdgeRow[]
}

export interface NotebookGraphQuery {
  getView(opts: {
    vaultId: string
    notebookId: string
    maxNodes?: number
  }): Promise<{ nodes: NotebookGraphNodeRow[]; edges: NotebookGraphEdgeRow[] }>
  getNeighborhood(opts: {
    vaultId: string
    notebookId: string
    nodeId: string
    maxNodes?: number
  }): Promise<{ nodes: NotebookGraphNodeRow[]; edges: NotebookGraphEdgeRow[] }>
  searchNodes(opts: {
    vaultId: string
    notebookId: string
    query: string
    limit?: number
  }): Promise<NotebookGraphNodeRow[]>
  findNodeByName(
    vaultId: string,
    notebookId: string,
    name: string,
    nodeType?: string
  ): Promise<NotebookGraphNodeRow | null>
  findShortestPath(opts: {
    vaultId: string
    notebookId: string
    fromId: string
    toId: string
    maxHops?: number
  }): Promise<NotebookGraphPath | null>
  getEdgeById(
    id: string,
    vaultId: string,
    notebookId: string
  ): Promise<NotebookGraphEdgeRow | null>
  listPendingNodes(vaultId: string, notebookId: string): Promise<NotebookGraphNodeRow[]>
  listPendingEdges(vaultId: string, notebookId: string): Promise<NotebookGraphEdgeRow[]>
}

export interface NotebookGraphSyncApply {
  getNodeById?(
    id: string,
    vaultId: string,
    notebookId: string
  ): Promise<NotebookGraphNodeRow | null>
  applyRawNode(row: {
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
  }): Promise<ApplyRawNodeResult | void>
  applyRawEdge(row: {
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
  }): Promise<void>
  listLiveIds(opts: { vaultId: string; notebookId: string }): Promise<{
    nodeIds: string[]
    edgeIds: string[]
    nodes: Array<{ id: string; shardMonth: string }>
    edges: Array<{ id: string; shardMonth: string }>
  }>
  softDeleteNode(id: string, notebookId: string): Promise<void>
  softDeleteEdge(id: string, notebookId: string): Promise<void>
}

export interface NotebookGraphWrite {
  softDeleteNode(id: string, notebookId: string): Promise<void>
  supersedeAiEdgesBySourcePrefix(opts: {
    notebookId: string
    sourceRefPrefix: string
    exceptIds: Set<string>
  }): Promise<number>
  deleteAllForNotebook(notebookId: string): Promise<void>
  deleteAllForVault(vaultId: string): Promise<void>
  deleteEdgesBySourcePrefix(notebookId: string, sourceId: string): Promise<void>
}

export interface NotebookGraphExtractStore {
  findNodeByName(
    vaultId: string,
    notebookId: string,
    name: string,
    nodeType?: string
  ): Promise<NotebookGraphNodeRow | null>
  supersedeAiEdgesBySourcePrefix(opts: {
    notebookId: string
    sourceRefPrefix: string
    exceptIds: Set<string>
  }): Promise<number>
}

export interface NotebookGraphRepositoryPort
  extends NotebookGraphQuery, NotebookGraphSyncApply, NotebookGraphWrite, NotebookGraphExtractStore {}
