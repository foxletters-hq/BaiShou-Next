/** Graph JSONL rows — shared so AI tools need not import @baishou/core */

export interface GraphNodeRawRecord {
  id: string
  schemaVersion: 1
  /** 稳定身份；新写入必填；sync 跳过缺字段行 */
  vaultId: string
  /** 写入时显示名快照，仅供人阅读；逻辑不得当真值 */
  vaultName: string
  nodeType: string
  name: string
  aliases: string[]
  summary: string
  props: Record<string, unknown>
  mentionCount: number
  firstSeenAt: number
  lastSeenAt: number
  origin: 'ai' | 'user'
  /** YYYY-MM JSONL shard (required for new writes). */
  shardMonth: string
  createdAt: number
  updatedAt: number
  deletedAt: number | null
  reviewStatus?: 'approved' | 'pending' | 'rejected'
}

export interface GraphEdgeRawRecord {
  id: string
  schemaVersion: 1
  /** 稳定身份；新写入必填；sync 跳过缺字段行 */
  vaultId: string
  /** 写入时显示名快照，仅供人阅读；逻辑不得当真值 */
  vaultName: string
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

export type GraphCollectionName = 'nodes' | 'edges' | 'extract-state'
