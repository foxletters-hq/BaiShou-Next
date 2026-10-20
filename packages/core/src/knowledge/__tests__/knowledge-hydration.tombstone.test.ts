import { describe, expect, it, vi } from 'vitest'
import { KnowledgeHydrationService } from '../knowledge-hydration.service'

describe('KnowledgeHydrationService last-notebook tombstone', () => {
  function createMocks(deletedIds: string[]) {
    const deleteNotebook = vi.fn().mockResolvedValue(undefined)
    const deleteSource = vi.fn().mockResolvedValue(undefined)
    const repo = {
      listNotebooks: vi
        .fn()
        .mockResolvedValue([{ id: 'nb_last', name: '最后一本', vaultId: 'vault_test' }]),
      listDistinctSourceIds: vi.fn().mockResolvedValue([]),
      getSource: vi.fn().mockResolvedValue(null),
      deleteSource,
      deleteNotebook
    }
    const notebookManager = {
      listNotebookRecords: vi.fn().mockResolvedValue([]),
      listDeletedNotebookIds: vi.fn().mockResolvedValue(deletedIds),
      listSourceRecords: vi.fn().mockResolvedValue([])
    }
    const svc = new KnowledgeHydrationService({
      repo: repo as never,
      notebookManager: notebookManager as never,
      vaultId: 'vault_test',
      isEmbeddingConfigured: () => false
    })
    return { svc, deleteNotebook, deleteSource }
  }

  it('cleans only tombstoned notebooks when no live notebook remains', async () => {
    const { svc, deleteNotebook } = createMocks(['nb_last'])
    const result = await svc.hydrate()
    expect(result.orphansCleaned).toBe(1)
    expect(deleteNotebook).toHaveBeenCalledWith('nb_last')
  })

  it('does not clean when notebooks.jsonl has no tombstone', async () => {
    const { svc, deleteNotebook } = createMocks([])
    const result = await svc.hydrate()
    expect(result.orphansCleaned).toBe(0)
    expect(deleteNotebook).not.toHaveBeenCalled()
  })
})
