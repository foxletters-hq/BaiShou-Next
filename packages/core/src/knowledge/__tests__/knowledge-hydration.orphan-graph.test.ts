import { describe, expect, it, vi } from 'vitest'
import { KnowledgeHydrationService } from '../knowledge-hydration.service'

describe('KnowledgeHydrationService orphan graph wiring', () => {
  it('orphan 删资料时删三个 jsonl，并带 deletedShardPaths 灌库', async () => {
    const deleteSourceShards = vi.fn().mockResolvedValue(undefined)
    const syncPendingIndex = vi.fn().mockResolvedValue({ shards: 0, nodes: 0, edges: 0 })
    const deleteSource = vi.fn().mockResolvedValue(undefined)
    const repo = {
      getNotebook: vi.fn().mockResolvedValue({
        id: 'nb1',
        name: '研究',
        description: null,
        vaultId: 'vault_test'
      }),
      listDistinctSourceIds: vi.fn().mockResolvedValue(['orphan']),
      getSource: vi.fn().mockResolvedValue({
        id: 'orphan',
        notebookId: 'nb1',
        vaultId: 'vault_test'
      }),
      deleteSource,
      listNotebooks: vi.fn().mockResolvedValue([{ id: 'nb1', vaultId: 'vault_test' }])
    }
    const notebookManager = {
      listNotebookRecords: vi
        .fn()
        .mockResolvedValue([{ id: 'nb1', name: '研究', description: null }]),
      listSourceRecords: vi.fn().mockResolvedValue([])
    }
    const graphRaw = {
      readCollapsed: vi.fn().mockResolvedValue([]),
      deleteSourceShards
    }

    const svc = new KnowledgeHydrationService({
      repo: repo as never,
      notebookManager: notebookManager as never,
      vaultId: 'vault_test',
      isEmbeddingConfigured: () => true,
      graphRaw: graphRaw as never,
      graphIndex: { syncPendingIndex }
    })
    const result = await svc.hydrate()

    expect(result.orphansCleaned).toBe(1)
    expect(deleteSourceShards).toHaveBeenCalledWith('nb1', 'orphan')
    expect(deleteSource).toHaveBeenCalledWith('orphan')
    expect(syncPendingIndex).toHaveBeenCalledWith({
      vaultId: 'vault_test',
      notebookId: 'nb1',
      deletedShardPaths: [
        'Notebooks/nb1/graph/nodes/orphan.jsonl',
        'Notebooks/nb1/graph/edges/orphan.jsonl'
      ]
    })
  })

  it('embedMissing false 不入队 embed/graph，仍灌 pending-index', async () => {
    const enqueueIngestJob = vi.fn()
    const syncPendingIndex = vi.fn().mockResolvedValue({ shards: 0, nodes: 0, edges: 0 })
    const repo = {
      getNotebook: vi.fn().mockResolvedValue(null),
      createNotebook: vi.fn().mockResolvedValue({ id: 'nb1' }),
      getSource: vi.fn().mockResolvedValue(null),
      countChunksBySource: vi.fn().mockResolvedValue(0),
      getEmbedLedger: vi.fn().mockResolvedValue(null),
      upsertSource: vi.fn(),
      updateSourceStatus: vi.fn(),
      enqueueIngestJob,
      listDistinctSourceIds: vi.fn().mockResolvedValue([]),
      listNotebooks: vi.fn().mockResolvedValue([{ id: 'nb1', vaultId: 'vault_test' }])
    }
    const notebookManager = {
      listNotebookRecords: vi.fn().mockResolvedValue([{ id: 'nb1', name: '本' }]),
      listSourceRecords: vi.fn().mockResolvedValue([
        {
          id: 'src1',
          title: '资料',
          kind: 'text',
          path: 'sources/src1.txt',
          contentHash: 'abc'
        }
      ]),
      statExtracted: vi.fn().mockResolvedValue({ mtimeMs: Date.now() }),
      readExtractedText: vi.fn().mockResolvedValue('正文')
    }

    const svc = new KnowledgeHydrationService({
      repo: repo as never,
      notebookManager: notebookManager as never,
      vaultId: 'vault_test',
      isEmbeddingConfigured: () => true,
      graphIndex: { syncPendingIndex }
    })
    const result = await svc.hydrate({ embedMissing: false })
    expect(result.embedJobsEnqueued).toBe(0)
    expect(result.graphJobsEnqueued).toBe(0)
    expect(enqueueIngestJob).not.toHaveBeenCalled()
    expect(syncPendingIndex).toHaveBeenCalledWith({ vaultId: 'vault_test', notebookId: 'nb1' })
  })

  it('should queue embed only when extracted text also needs graph', async () => {
    const enqueueIngestJob = vi.fn()
    const repo = {
      getNotebook: vi.fn().mockResolvedValue(null),
      createNotebook: vi.fn().mockResolvedValue({ id: 'nb1' }),
      updateNotebook: vi.fn(),
      getSource: vi.fn().mockResolvedValue(null),
      countChunksBySource: vi.fn().mockResolvedValue(0),
      getEmbedLedger: vi.fn().mockResolvedValue(null),
      upsertSource: vi.fn(),
      updateSourceStatus: vi.fn(),
      enqueueIngestJob,
      listDistinctSourceIds: vi.fn().mockResolvedValue([]),
      listNotebooks: vi.fn().mockResolvedValue([{ id: 'nb1', vaultId: 'vault_test' }])
    }
    const notebookManager = {
      listNotebookRecords: vi.fn().mockResolvedValue([{ id: 'nb1', name: '本' }]),
      listSourceRecords: vi.fn().mockResolvedValue([
        {
          id: 'src1',
          title: '资料',
          kind: 'text',
          path: 'sources/src1.txt',
          contentHash: 'abc'
        }
      ]),
      statExtracted: vi.fn().mockResolvedValue({ mtimeMs: Date.now() }),
      readExtractedText: vi.fn().mockResolvedValue('正文需要向量后再抽图'),
      findCoverImageOnDisk: vi.fn().mockResolvedValue('')
    }

    const svc = new KnowledgeHydrationService({
      repo: repo as never,
      notebookManager: notebookManager as never,
      vaultId: 'vault_test',
      isEmbeddingConfigured: () => true
    })
    const result = await svc.hydrate()
    expect(result.embedJobsEnqueued).toBe(1)
    expect(result.graphJobsEnqueued).toBe(0)
    expect(enqueueIngestJob.mock.calls.map((call) => call[0].stage)).toEqual(['embed'])
  })
})
