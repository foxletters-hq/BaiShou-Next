import { describe, expect, it, vi } from 'vitest'
import { KnowledgeIngestService } from '../knowledge-ingest.service'

describe('processEmbedJob progress', () => {
  it('should emit embed chunk progress for the current source', async () => {
    const onExtractProgress = vi.fn()
    const repo = {
      getSource: vi.fn().mockResolvedValue({
        id: 'src_1',
        notebookId: 'nb1',
        vaultId: 'vault_test',
        extractedTextHash: 'hash-1',
        title: '深度关系',
        sourceKind: 'text',
        relativePath: 'nb1/sources/src_1.txt',
        pageCount: 1,
        textPageCount: 1,
        errorMessage: null,
        status: 'pending'
      }),
      updateSourceStatus: vi.fn().mockResolvedValue(undefined),
      recordEmbedded: vi.fn().mockResolvedValue(undefined),
      recordEmbedFailure: vi.fn().mockResolvedValue(undefined),
      deleteChunksBySourceFromIndex: vi.fn().mockResolvedValue(undefined)
    }
    const svc = new KnowledgeIngestService({
      repo: repo as never,
      notebookManager: {
        readExtractedText: vi.fn().mockResolvedValue('第一段。'.repeat(80))
      } as never,
      fs: {} as never,
      getVaultId: () => 'vault_test',
      onExtractProgress,
      embedding: {
        isConfigured: true,
        getModelId: () => 'mock-emb',
        getProviderInstance: async () => null
      },
      embedText: async () => [0.1, 0.2, 0.3, 0.4],
      insertChunk: vi.fn().mockResolvedValue(undefined),
      deleteChunksBySource: vi.fn().mockResolvedValue(undefined)
    })

    await svc.processEmbedJob('src_1')

    const embedEvents = onExtractProgress.mock.calls
      .map((call) => call[0])
      .filter((info) => info.phase === 'embed')
    expect(embedEvents.length).toBeGreaterThan(1)
    expect(embedEvents[0]).toEqual(
      expect.objectContaining({ sourceId: 'src_1', page: 0, phase: 'embed' })
    )
    expect(embedEvents.at(-1)).toEqual(
      expect.objectContaining({
        sourceId: 'src_1',
        page: embedEvents[0]?.total,
        total: embedEvents[0]?.total,
        phase: 'embed'
      })
    )
  })
})
