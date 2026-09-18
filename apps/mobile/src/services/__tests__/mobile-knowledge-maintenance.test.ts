import { describe, expect, it, vi, beforeEach } from 'vitest'
import { KnowledgeIngestService, KNOWLEDGE_SOURCE_NOT_EMBEDDED_ERROR } from '@baishou/core-mobile'

function createRepo() {
  return {
    getSource: vi.fn(),
    updateSourceStatus: vi.fn().mockResolvedValue(undefined),
    enqueueIngestJob: vi.fn().mockResolvedValue(undefined),
    getEmbedLedger: vi.fn().mockResolvedValue(null),
    countChunksBySource: vi.fn().mockResolvedValue(0),
    listSources: vi.fn().mockResolvedValue([]),
    deleteChunksByNotebook: vi.fn().mockResolvedValue(undefined),
    rebuildEmbedLedger: vi.fn().mockResolvedValue(undefined),
    recordEmbedded: vi.fn().mockResolvedValue(undefined),
    recordEmbedFailure: vi.fn().mockResolvedValue(undefined),
    deleteChunksBySourceFromIndex: vi.fn().mockResolvedValue(undefined)
  }
}

function createService(repo: ReturnType<typeof createRepo>) {
  return new KnowledgeIngestService({
    repo: repo as never,
    notebookManager: {
      readExtractedText: vi.fn().mockResolvedValue('已经抽出的正文，用于分块向量。')
    } as never,
    fs: {} as never,
    getVaultId: () => 'vault_test',
    embedding: {
      isConfigured: true,
      getModelId: () => 'mock-emb',
      getProviderInstance: async () => null
    },
    embedText: async () => [0.1, 0.2, 0.3, 0.4],
    insertChunk: vi.fn().mockResolvedValue(undefined),
    deleteChunksBySource: vi.fn().mockResolvedValue(undefined),
    extractNotebookGraph: vi.fn().mockResolvedValue(undefined)
  })
}

const extractedSource = {
  id: 'src_mobile_rebuild',
  notebookId: 'nb1',
  vaultId: 'vault_test',
  extractedTextHash: 'hash-1',
  title: '资料',
  sourceKind: 'text',
  relativePath: 'nb1/sources/src_mobile_rebuild.txt',
  pageCount: 1,
  textPageCount: 1,
  errorMessage: null,
  status: 'ready'
}

describe('mobile knowledge maintenance via rebuildIndex', () => {
  let repo: ReturnType<typeof createRepo>
  let svc: KnowledgeIngestService

  beforeEach(() => {
    repo = createRepo()
    svc = createService(repo)
    repo.getSource.mockResolvedValue(extractedSource)
  })

  it('should mark graph follow after rebuildIndex so embed can queue graph', async () => {
    repo.listSources.mockResolvedValue([extractedSource])
    await svc.rebuildIndex('nb1')
    expect(repo.rebuildEmbedLedger).toHaveBeenCalled()
    repo.enqueueIngestJob.mockClear()
    await svc.processEmbedJob('src_mobile_rebuild')
    const stages = repo.enqueueIngestJob.mock.calls.map((call) => call[0].stage)
    expect(stages).toEqual(['graph'])
  })

  it('should reject graph-only reprocess when the source is not embedded', async () => {
    await expect(svc.reprocessSource('src_mobile_rebuild', 'graph')).rejects.toThrow(
      KNOWLEDGE_SOURCE_NOT_EMBEDDED_ERROR
    )
    expect(repo.enqueueIngestJob).not.toHaveBeenCalled()
  })
})
