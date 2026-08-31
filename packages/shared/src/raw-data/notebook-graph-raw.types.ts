/** 知识本图谱 JSONL — 与日记 Graph/ 行类型隔离，notebookId 必填 */

export interface NotebookGraphNodeRawRecord {
  id: string
  schemaVersion: 1
  vaultId: string
  vaultName: string
  notebookId: string
  nodeType: string
  name: string
  aliases: string[]
  summary: string
  props: Record<string, unknown>
  mentionCount: number
  firstSeenAt: number
  lastSeenAt: number
  origin: 'ai' | 'user'
  shardMonth: string
  createdAt: number
  updatedAt: number
  deletedAt: number | null
  reviewStatus?: 'approved' | 'pending' | 'rejected'
}

export interface NotebookGraphEdgeRawRecord {
  id: string
  schemaVersion: 1
  vaultId: string
  vaultName: string
  notebookId: string
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
}

export interface NotebookGraphExtractStateRawRecord {
  id: string
  schemaVersion: 1
  vaultId: string
  vaultName: string
  notebookId: string
  sourceId: string
  extractedTextHash: string
  windowsDone: number
  windowsTotal: number
  truncated?: boolean
  extractedAt: number
  updatedAt: number
  deletedAt: number | null
}

export type NotebookGraphCollection = 'nodes' | 'edges' | 'extract-state'
