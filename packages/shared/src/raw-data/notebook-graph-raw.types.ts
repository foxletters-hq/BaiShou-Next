/** 知识本图谱 JSONL — 与日记 Graph/ 行类型隔离，notebookId 必填 */

export interface NotebookGraphNodeRawRecord {
  id: string
  schemaVersion: 1
  vaultId: string
  vaultName: string
  notebookId: string
  nodeType: string
  name: string
  /** 参与节点身份的区分信息，必须跨设备一致；JSONL 是真源。可选是为了兼容老记录行。 */
  discriminator?: string
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

/** 已抽完、尚未整批对齐写入的窗口载荷。缺省表示对齐尚未完成。 */
export interface NotebookGraphExtractedWindowPayload {
  index: number
  sourceRef: string
  sourceContext?: string
  entities: Array<{
    name?: string
    type?: string
    aliases?: string[]
    summary?: string
    confidence?: number
  }>
  edges: Array<{
    from?: string
    to?: string
    type?: string
    excerpt?: string
    confidence?: number
  }>
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
  /** 已抽完窗口的实体/边。缺省表示这是对齐尚未完成的老记录或中断记录。 */
  extractedWindows?: NotebookGraphExtractedWindowPayload[]
  /** 整批对齐并写入节点/边之后为 true。缺省视为未写入。 */
  alignWritten?: boolean
}

export type NotebookGraphCollection = 'nodes' | 'edges' | 'extract-state'
