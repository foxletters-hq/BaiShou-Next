export type KnowledgeEmbedLedgerMatch = {
  contentHash: string
  modelId: string
  dimension: number
  status: string
}

/**
 * 知识整理是否要把这份资料排进手动嵌入。
 * 与日记一样看账本：没嵌过、失败、模型变了、正文哈希变了，都算欠账。
 * 水合在哈希对不上时会把资料标 pending，账本行往往还停在 embedded，排队必须读到这个状态。
 */
export function shouldQueueKnowledgeSourceEmbed(input: {
  extractedTextHash?: string | null
  sourceStatus?: string | null
  currentEmbedContentHash?: string | null
  ledger?: KnowledgeEmbedLedgerMatch | null
  currentModelId?: string
  currentDimension?: number
}): boolean {
  if (!input.extractedTextHash?.trim()) return false

  const sourceStatus = (input.sourceStatus ?? '').trim()
  if (sourceStatus === 'pending') return true

  const ledger = input.ledger
  if (!ledger || ledger.status !== 'embedded') return true

  const currentHash = input.currentEmbedContentHash?.trim() ?? ''
  if (currentHash && currentHash !== ledger.contentHash.trim()) return true

  const modelId = input.currentModelId?.trim() ?? ''
  if (modelId && ledger.modelId !== modelId) return true

  const dimension = input.currentDimension ?? 0
  if (dimension > 0 && ledger.dimension !== dimension) return true

  return false
}
