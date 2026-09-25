import { describe, expect, it } from 'vitest'
import { hashEmbedSourceContent } from '../../utils/rag-diary.util'
import { shouldQueueKnowledgeSourceEmbed } from '../knowledge-embed-pending.util'

const embedded = {
  contentHash: hashEmbedSourceContent('旧正文'),
  modelId: 'm1',
  dimension: 8,
  status: 'embedded'
}

describe('shouldQueueKnowledgeSourceEmbed', () => {
  it('should skip when extracted text is missing', () => {
    expect(
      shouldQueueKnowledgeSourceEmbed({
        extractedTextHash: '',
        sourceStatus: 'pending',
        ledger: null
      })
    ).toBe(false)
  })

  it('should queue when hydration marked the source pending even if ledger is still embedded', () => {
    expect(
      shouldQueueKnowledgeSourceEmbed({
        extractedTextHash: 'md5',
        sourceStatus: 'pending',
        ledger: embedded
      })
    ).toBe(true)
  })

  it('should queue when current embed hash does not match the ledger', () => {
    expect(
      shouldQueueKnowledgeSourceEmbed({
        extractedTextHash: 'md5',
        sourceStatus: 'ready',
        currentEmbedContentHash: hashEmbedSourceContent('新正文'),
        ledger: embedded
      })
    ).toBe(true)
  })

  it('should skip when ledger is current embedded and hashes match', () => {
    expect(
      shouldQueueKnowledgeSourceEmbed({
        extractedTextHash: 'md5',
        sourceStatus: 'ready',
        currentEmbedContentHash: hashEmbedSourceContent('旧正文'),
        ledger: embedded,
        currentModelId: 'm1',
        currentDimension: 8
      })
    ).toBe(false)
  })
})
