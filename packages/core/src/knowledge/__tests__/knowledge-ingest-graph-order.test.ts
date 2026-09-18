import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  KnowledgeIngestService,
  KNOWLEDGE_SOURCE_NOT_EMBEDDED_ERROR,
  markGraphFollowAfterEmbed
} from '../knowledge-ingest.service'

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

function createService(
  repo: ReturnType<typeof createRepo>,
  opts?: { embedText?: (t: string) => Promise<number[]> }
) {
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
    embedText: opts?.embedText ?? (async () => [0.1, 0.2, 0.3, 0.4]),
    insertChunk: vi.fn().mockResolvedValue(undefined),
    deleteChunksBySource: vi.fn().mockResolvedValue(undefined),
    extractNotebookGraph: vi.fn().mockResolvedValue(undefined)
  })
}

const extractedSource = {
  id: 'src_order',
  notebookId: 'nb1',
  vaultId: 'vault_test',
  extractedTextHash: 'hash-1',
  title: '资料',
  sourceKind: 'text',
  relativePath: 'nb1/sources/src_order.txt',
  pageCount: 1,
  textPageCount: 1,
  errorMessage: null,
  status: 'ready'
}

describe('KnowledgeIngestService graph order', () => {
  let repo: ReturnType<typeof createRepo>
  let svc: KnowledgeIngestService

  beforeEach(() => {
    repo = createRepo()
    svc = createService(repo)
    repo.getSource.mockResolvedValue(extractedSource)
  })

  it('should queue embed only when retrying an extracted source', async () => {
    await svc.retrySource('src_order')
    const stages = repo.enqueueIngestJob.mock.calls.map((call) => call[0].stage)
    expect(stages).toEqual(['embed'])
  })

  it('should queue graph only after retry embed succeeds', async () => {
    await svc.retrySource('src_order')
    repo.enqueueIngestJob.mockClear()
    await svc.processEmbedJob('src_order')
    const stages = repo.enqueueIngestJob.mock.calls.map((call) => call[0].stage)
    expect(stages).toEqual(['graph'])
  })

  it('should queue graph after a followed embed succeeds', async () => {
    markGraphFollowAfterEmbed('src_order')
    await svc.processEmbedJob('src_order')
    const stages = repo.enqueueIngestJob.mock.calls.map((call) => call[0].stage)
    expect(stages).toEqual(['graph'])
    expect(repo.recordEmbedded).toHaveBeenCalled()
  })

  it('should not queue graph when embed fails', async () => {
    markGraphFollowAfterEmbed('src_fail')
    repo.getSource.mockResolvedValue({ ...extractedSource, id: 'src_fail' })
    const failSvc = createService(repo, {
      embedText: async () => {
        throw new Error('embed boom')
      }
    })
    await expect(failSvc.processEmbedJob('src_fail')).rejects.toThrow('embed boom')
    expect(repo.enqueueIngestJob).not.toHaveBeenCalled()
  })

  it('should throw when reprocessing graph before chunks are embedded', async () => {
    await expect(svc.reprocessSource('src_order', 'graph')).rejects.toThrow(
      KNOWLEDGE_SOURCE_NOT_EMBEDDED_ERROR
    )
    expect(repo.enqueueIngestJob).not.toHaveBeenCalled()
  })

  it('should skip unembedded sources when rebuilding notebook graph', async () => {
    repo.listSources.mockResolvedValue([extractedSource])
    const queued = await svc.rebuildNotebookGraph('nb1')
    expect(queued).toBe(0)
    expect(repo.enqueueIngestJob).not.toHaveBeenCalled()
  })

  it('should queue graph when reprocessing after embed ledger is present', async () => {
    repo.getEmbedLedger.mockResolvedValue({
      status: 'embedded',
      chunkCount: 2
    })
    await svc.reprocessSource('src_order', 'graph')
    expect(repo.enqueueIngestJob).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: 'src_order', stage: 'graph' })
    )
  })

  it('should not queue graph after embed when follow was not marked', async () => {
    await svc.processEmbedJob('src_order')
    expect(repo.enqueueIngestJob).not.toHaveBeenCalled()
  })

  it('should queue embed only when rebuilding the notebook index', async () => {
    repo.listSources.mockResolvedValue([extractedSource])
    await svc.rebuildIndex('nb1')
    const stages = repo.enqueueIngestJob.mock.calls.map((call) => call[0].stage)
    expect(stages).toEqual(['embed'])
  })

  it('should mark graph follow after rebuildIndex so embed can queue graph', async () => {
    repo.listSources.mockResolvedValue([extractedSource])
    await svc.rebuildIndex('nb1')
    repo.enqueueIngestJob.mockClear()
    await svc.processEmbedJob('src_order')
    const stages = repo.enqueueIngestJob.mock.calls.map((call) => call[0].stage)
    expect(stages).toEqual(['graph'])
  })

  it('should skip stored sources when rebuilding the notebook index', async () => {
    repo.listSources.mockResolvedValue([{ ...extractedSource, status: 'stored' }])
    await svc.rebuildIndex('nb1')
    expect(repo.enqueueIngestJob).not.toHaveBeenCalled()
    expect(repo.rebuildEmbedLedger).toHaveBeenCalled()
  })
})
