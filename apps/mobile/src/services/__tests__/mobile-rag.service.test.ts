import { describe, it, expect, vi, beforeEach } from 'vitest'
import { embedDiaryEntry, runControlledDiaryBatchEmbed, type MobileRagServiceDeps } from '../mobile-rag.service'
import { EmbeddingAdapter } from '@baishou/ai'

function createDeps(overrides: Partial<MobileRagServiceDeps> = {}): MobileRagServiceDeps {
  const settingsStore: Record<string, unknown> = {
    rag_config: { ragEnabled: true, ragTopK: 20, ragSimilarityThreshold: 0.4 },
    global_models: { globalEmbeddingDimension: 3 }
  }

  return {
    settingsManager: {
      get: vi.fn(async (key: string) => settingsStore[key]),
      set: vi.fn(async (key: string, value: unknown) => {
        settingsStore[key] = value
      })
    },
    diaryService: {
      listAll: vi.fn().mockResolvedValue([]),
      findByIdsForEmbedding: vi.fn().mockResolvedValue(new Map())
    },
    hsRepo: {
      initVectorIndex: vi.fn().mockResolvedValue(undefined),
      deleteEmbeddingsBySource: vi.fn().mockResolvedValue(undefined),
      getCurrentEmbeddingMeta: vi.fn(),
      countHeterogeneousEmbeddings: vi.fn(),
      clearEmbeddings: vi.fn()
    },
    hybridSearchService: {} as MobileRagServiceDeps['hybridSearchService'],
    registry: { getOrUpdateProvider: vi.fn() } as unknown as MobileRagServiceDeps['registry'],
    rawSqlClient: {
      execute: vi.fn().mockResolvedValue({ rows: [{ count: 5 }] })
    },
    ...overrides
  } as MobileRagServiceDeps
}

describe('embedDiaryEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes partial embeddings when embedText fails', async () => {
    const deps = createDeps()
    const adapter = {
      embedText: vi.fn().mockRejectedValue(new Error('incomplete vectors'))
    } as unknown as EmbeddingAdapter

    await expect(
      embedDiaryEntry(
        deps,
        {
          diaryId: 42,
          content: 'hello',
          tags: [],
          date: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
          groupId: 'test'
        },
        { adapter, skipIndexPrep: true, skipRagEnabledCheck: true }
      )
    ).rejects.toThrow('incomplete vectors')

    expect(deps.hsRepo.deleteEmbeddingsBySource).toHaveBeenCalledTimes(3)
    expect(deps.hsRepo.deleteEmbeddingsBySource).toHaveBeenNthCalledWith(1, 'diary', 'Personal#42')
    expect(deps.hsRepo.deleteEmbeddingsBySource).toHaveBeenNthCalledWith(2, 'diary', '42')
    expect(deps.hsRepo.deleteEmbeddingsBySource).toHaveBeenNthCalledWith(3, 'diary', 'Personal#42')
  })
})

describe('runControlledDiaryBatchEmbed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks embed failure when prepare step fails', async () => {
    vi.useFakeTimers()
    const settingsStore: Record<string, unknown> = {
      rag_config: { ragEnabled: true, ragTopK: 20, ragSimilarityThreshold: 0.4 },
      global_models: {
        globalEmbeddingDimension: 0,
        globalEmbeddingProviderId: 'provider-1',
        globalEmbeddingModelId: 'embed-model'
      },
      ai_providers: [
        {
          id: 'provider-1',
          type: 'openai',
          apiKey: 'k',
          baseUrl: '',
          models: [],
          enabledModels: [],
          defaultDialogueModel: '',
          defaultNamingModel: '',
          isEnabled: true,
          isSystem: false,
          sortOrder: 0
        }
      ]
    }

    const deps = createDeps({
      settingsManager: {
        get: vi.fn(async (key: string) => settingsStore[key]),
        set: vi.fn(async (key: string, value: unknown) => {
          settingsStore[key] = value
        })
      },
      registry: {
        getOrUpdateProvider: vi.fn().mockReturnValue({
          getEmbeddingModel: vi.fn().mockReturnValue('mock-model')
        })
      } as unknown as MobileRagServiceDeps['registry']
    })

    vi.spyOn(EmbeddingAdapter.prototype, 'embedQuery').mockResolvedValue(null)

    const promise = runControlledDiaryBatchEmbed(deps)
    await vi.runAllTimersAsync()
    const result = await promise
    vi.useRealTimers()

    expect(result.skipped).toBe(true)
    expect(result.skipReason).toBe('prepare-failed')
    const saved = settingsStore.rag_config as {
      lastDiaryEmbedFailureAt?: number
      totalEmbeddings?: number
    }
    expect(saved.lastDiaryEmbedFailureAt).toBeGreaterThan(0)
    expect(saved.totalEmbeddings).toBe(5)
  })
})
