export type KnowledgeEmbedLedgerRecord = {
  vaultId: string
  sourceId: string
  contentHash: string
  chunkCount: number
  modelId: string
  dimension: number
}

export type KnowledgeEmbedLedgerView = {
  vaultId: string
  sourceId: string
  contentHash: string
  chunkCount: number
  modelId: string
  dimension: number
  status: string
}

export const KNOWLEDGE_EMBED_LEDGER_REBUILD_SAVEPOINT = 'knowledge_embed_ledger_rebuild'

export type KnowledgeSourceStatus =
  | 'pending'
  | 'extracting'
  | 'needs_ocr'
  | 'partial'
  | 'embedding'
  | 'ready'
  | 'failed'
  | 'stored'

export type KnowledgeIngestStage = 'extract' | 'embed' | 'graph'
export type KnowledgeIngestJobStatus = 'pending' | 'running' | 'failed'

/** 向量页列表项：不返回 embedding BLOB */
export type KnowledgeChunkListItem = {
  chunkId: string
  sourceId: string
  notebookId: string
  chunkIndex: number
  chunkText: string
  metadataJson: string
  dimension: number
  modelId: string
  createdAt: number
  sourceTitle: string | null
}
