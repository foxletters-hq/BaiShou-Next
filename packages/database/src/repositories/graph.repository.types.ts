import type { GraphEdgeType, GraphNodeType } from '../schema/graph'

export interface GraphNodeRow {
  id: string
  vaultId: string
  nodeType: string
  name: string
  nameNormalized: string
  discriminator: string
  aliases: string[]
  summary: string
  propsJson: string
  mentionCount: number
  firstSeenAt: number | null
  lastSeenAt: number | null
  origin: string
  shardMonth: string
  reviewStatus: string
  modelId: string
  dimension: number | null
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface GraphEdgeRow {
  id: string
  vaultId: string
  fromId: string
  toId: string
  edgeType: string
  propsJson: string
  validFrom: number | null
  validTo: number | null
  isCurrent: boolean
  sourceKind: string
  sourceRef: string | null
  sourceExcerpt: string
  sourceContentHash: string | null
  confidence: number
  origin: string
  reviewStatus: string
  shardMonth: string
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export type ApplyRawNodeResult = {
  id: string
  remappedFrom?: string
  remappedFromShardMonth?: string
  writeBackSurvivor?: boolean
}

export interface UpsertNodeInput {
  id?: string
  vaultId: string
  nodeType: GraphNodeType | string
  name: string
  discriminator?: string
  aliases?: string[]
  summary?: string
  propsJson?: string
  embedding?: number[] | null
  modelId?: string
  mentionCount?: number
  firstSeenAt?: number | null
  lastSeenAt?: number | null
  origin?: 'ai' | 'user'
  shardMonth?: string
  reviewStatus?: 'approved' | 'pending' | 'rejected'
  /** When true, skip name/vector disambiguation and upsert by id */
  forceId?: boolean
  createdAt?: number
  updatedAt?: number
  deletedAt?: number | null
}

export interface UpsertEdgeInput {
  id: string
  vaultId: string
  fromId: string
  toId: string
  edgeType: GraphEdgeType | string
  propsJson?: string
  validFrom?: number | null
  validTo?: number | null
  isCurrent?: boolean
  sourceKind?: string
  sourceRef?: string | null
  sourceExcerpt?: string
  sourceContentHash?: string | null
  confidence?: number
  origin?: 'ai' | 'user'
  reviewStatus?: 'approved' | 'pending' | 'rejected'
  shardMonth: string
  createdAt?: number
  updatedAt?: number
  deletedAt?: number | null
}

/** Shortest path between graph nodes (edges in hop order). */
export interface GraphPath {
  nodeIds: string[]
  edges: GraphEdgeRow[]
  /**
   * Parallel to `edges`: whether each hop followed the stored edge direction
   * (`fromId→toId`) or walked it in reverse (`toId→fromId`) during undirected BFS.
   */
  edgeDirections?: Array<'forward' | 'reverse'>
}
