/** Facade for AI tools — no @baishou/core import */

export interface ToolGraphPath {
  nodeIds: string[]
  nodeNames: string[]
  edges: Array<{
    id: string
    fromId: string
    toId: string
    edgeType: string
    sourceRef?: string | null
    sourceExcerpt?: string
  }>
  /** Parallel to edges: undirected BFS may walk reverse of stored from→to. */
  edgeDirections?: Array<'forward' | 'reverse'>
}

export interface ToolGraphRagResult {
  anchors: Array<{
    id: string
    name: string
    nodeType: string
    summary?: string
  }>
  subgraph: Array<{
    id: string
    fromId: string
    toId: string
    edgeType: string
    sourceRef?: string | null
    sourceExcerpt?: string
    validFrom?: number | null
  }>
  timeline?: Array<{
    id: string
    fromId: string
    toId: string
    edgeType: string
    sourceRef?: string | null
    sourceExcerpt?: string
    validFrom?: number | null
  }>
  nodes: Array<{
    id: string
    name: string
    nodeType: string
    summary?: string
  }>
  /** Shortest relation paths with diary excerpts (network mode). */
  paths?: ToolGraphPath[]
}

export type GraphRecallMode = 'network' | 'timeline' | 'neighbors' | 'search'

export interface ToolGraphRecallOpts {
  entity: string
  mode: GraphRecallMode
  /** Path / neighbor hop cap. network defaults to 3; neighbors defaults to 1. */
  depth?: 1 | 2 | 3
  /** Optional node type filter, e.g. person / place / event / topic. */
  nodeType?: string
  /** Max nodes or paths to return (1–20). */
  limit?: number
}

export interface ToolGraphNodeHit {
  id: string
  name: string
  nodeType: string
  aliases?: string[]
  summary?: string
  mentionCount?: number
  firstSeenAt?: number | null
  createdAt?: number
  shardMonth?: string
  origin?: 'ai' | 'user'
}

export function toToolGraphNodeHit(row: {
  id: string
  name: string
  nodeType: string
  aliases?: string[]
  summary?: string
  mentionCount?: number
  firstSeenAt?: number | null
  createdAt?: number
  shardMonth?: string
  origin?: string
}): ToolGraphNodeHit {
  return {
    id: row.id,
    name: row.name,
    nodeType: row.nodeType,
    aliases: row.aliases,
    summary: row.summary,
    mentionCount: row.mentionCount,
    firstSeenAt: row.firstSeenAt,
    createdAt: row.createdAt,
    shardMonth: row.shardMonth,
    origin: row.origin === 'user' ? 'user' : row.origin === 'ai' ? 'ai' : undefined
  }
}

export interface ToolGraphRecaller {
  recallRelations(opts: ToolGraphRecallOpts): Promise<ToolGraphRagResult>
}

export interface ToolGraphNodeLookup {
  findNodeByName(opts: {
    name: string
    nodeType?: string
  }): Promise<ToolGraphNodeHit | null>
  findNodeById?(id: string): Promise<ToolGraphNodeHit | null>
}

export interface ToolGraphEdgeHit {
  id: string
  fromId: string
  toId: string
  edgeType: string
  sourceRef?: string | null
  sourceExcerpt?: string
  sourceKind?: string
  shardMonth?: string
  createdAt?: number
  validFrom?: number | null
  validTo?: number | null
  isCurrent?: boolean
  confidence?: number
  origin?: 'ai' | 'user'
  sourceContentHash?: string | null
}

export function toToolGraphEdgeHit(row: {
  id: string
  fromId: string
  toId: string
  edgeType: string
  sourceRef?: string | null
  sourceExcerpt?: string
  sourceKind?: string
  shardMonth?: string
  createdAt?: number
  validFrom?: number | null
  validTo?: number | null
  isCurrent?: boolean
  confidence?: number
  origin?: string
  sourceContentHash?: string | null
}): ToolGraphEdgeHit {
  return {
    id: row.id,
    fromId: row.fromId,
    toId: row.toId,
    edgeType: row.edgeType,
    sourceRef: row.sourceRef,
    sourceExcerpt: row.sourceExcerpt,
    sourceKind: row.sourceKind,
    shardMonth: row.shardMonth,
    createdAt: row.createdAt,
    validFrom: row.validFrom,
    validTo: row.validTo,
    isCurrent: row.isCurrent,
    confidence: row.confidence,
    origin: row.origin === 'user' ? 'user' : row.origin === 'ai' ? 'ai' : undefined,
    sourceContentHash: row.sourceContentHash
  }
}

export interface ToolGraphEdgeLookup {
  findEdgeById(id: string): Promise<ToolGraphEdgeHit | null>
}

/** Read-only GraphRAG. Node lookup is `ToolGraphNodeLookup`, not this type. */
export type ToolGraphReader = ToolGraphRecaller
