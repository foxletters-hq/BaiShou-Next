import { describe, expect, it, vi } from 'vitest'
import type { KnowledgeIngestDeps } from '../knowledge-ingest.types'
import { deleteNotebook } from '../knowledge-ingest.notebook'
import { deleteSource } from '../knowledge-ingest.source'

vi.mock('../knowledge-ingest.source', () => ({
  deleteSource: vi.fn()
}))

function notebookRow(id = 'nb_1') {
  return {
    id,
    vaultId: 'vault_test',
    name: '整本删除',
    description: '',
    createdAt: 1,
    updatedAt: 2,
    sortOrder: 0,
    coverTone: null,
    coverIcon: null,
    coverImage: null
  }
}

function makeDeps(overrides?: {
  notebook?: ReturnType<typeof notebookRow> | null
  sources?: Array<{ id: string }>
  exists?: boolean
}): KnowledgeIngestDeps {
  return {
    repo: {
      getNotebook: vi.fn(async () =>
        overrides && 'notebook' in overrides ? overrides.notebook : notebookRow()
      ),
      listSources: vi.fn(async () => overrides?.sources ?? []),
      deleteNotebook: vi.fn(async () => undefined)
    } as unknown as KnowledgeIngestDeps['repo'],
    notebookManager: {
      appendNotebookRecord: vi.fn(async () => undefined),
      absolutePath: vi.fn(async (rel: string) => `/vault/Notebooks/${rel}`)
    } as unknown as KnowledgeIngestDeps['notebookManager'],
    fs: {
      exists: vi.fn(async () => overrides?.exists !== false),
      rm: vi.fn(async () => undefined)
    } as unknown as KnowledgeIngestDeps['fs'],
    getVaultId: () => 'vault_test',
    insertChunk: async () => undefined,
    deleteChunksBySource: async () => undefined
  }
}

describe('deleteNotebook', () => {
  it('should reject when the notebook is missing', async () => {
    const deps = makeDeps({ notebook: null })
    await expect(deleteNotebook(deps, 'nb_missing')).rejects.toThrow('notebook not found')
    expect(deps.repo.deleteNotebook).not.toHaveBeenCalled()
  })

  it('should tombstone the record, remove the directory, and clear local rows', async () => {
    const deps = makeDeps({
      sources: [{ id: 'src_1' }, { id: 'src_2' }]
    })
    vi.mocked(deleteSource).mockResolvedValue(undefined)
    await deleteNotebook(deps, 'nb_1')
    expect(deleteSource).toHaveBeenCalledTimes(2)
    expect(deps.notebookManager.appendNotebookRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'nb_1',
        deletedAt: expect.any(Number)
      })
    )
    expect(deps.fs.rm).toHaveBeenCalledWith('/vault/Notebooks/nb_1', {
      recursive: true,
      force: true
    })
    expect(deps.repo.deleteNotebook).toHaveBeenCalledWith('nb_1')
  })
})
