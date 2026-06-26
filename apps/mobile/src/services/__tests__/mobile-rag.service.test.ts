import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createMobileRagService,
  embedDiaryEntry,
  isDeferredPostSyncEmbedPending,
  isMobileRagReembedInFlight,
  resetMobileRagBatchStateForTests,
  runControlledDiaryBatchEmbed,
  type MobileRagServiceDeps
} from '../mobile-rag.service'
import { EmbeddingAdapter } from '@baishou/ai'
import { mobileRagOperationControl } from '../mobile-rag-operation-control'
import { setMobileDiaryEmbeddingDeps } from '../mobile-diary-embedding.service'

function createDeps(overrides: Partial<MobileRagServiceDeps> = {}): MobileRagServiceDeps {
  const settingsStore: Record<string, unknown> = {
    rag_config: { ragEnabled: true, ragTopK: 20, ragSimilarityThreshold: 0.4 },
    global_models: {
      globalEmbeddingDimension: 3,
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
      clearEmbeddings: vi.fn().mockResolvedValue(undefined)
    },
    hybridSearchService: {} as MobileRagServiceDeps['hybridSearchService'],
    registry: {
      getOrUpdateProvider: vi.fn().mockReturnValue({
        getEmbeddingModel: vi.fn().mockReturnValue('mock-model')
      })
    } as unknown as MobileRagServiceDeps['registry'],
    rawSqlClient: {
      execute: vi.fn().mockResolvedValue({ rows: [{ count: 5 }] })
    },
    ...overrides
  } as MobileRagServiceDeps
}

describe('embedDiaryEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMobileRagBatchStateForTests()
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
    resetMobileRagBatchStateForTests()
  })

  it('returns migration-running when a batch embed is already in flight', async () => {
    const deps = createDeps()
    let releaseFirst!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    vi.spyOn(EmbeddingAdapter.prototype, 'embedQuery').mockImplementation(async () => {
      await gate
      return [0.1, 0.2, 0.3]
    })

    const first = runControlledDiaryBatchEmbed(deps)
    await Promise.resolve()
    const second = await runControlledDiaryBatchEmbed(deps)

    expect(second.skipped).toBe(true)
    expect(second.skipReason).toBe('migration-running')

    releaseFirst()
    await first
  })

  it('coalesceRerun waits for the in-flight batch and reruns once', async () => {
    const deps = createDeps()
    let calls = 0

    vi.spyOn(EmbeddingAdapter.prototype, 'embedQuery').mockResolvedValue([0.1, 0.2, 0.3])
    deps.diaryService.listAll = vi
      .fn()
      .mockResolvedValueOnce([
        { id: 1, date: new Date('2024-01-01'), tags: [], updatedAt: new Date('2024-01-02') }
      ])
      .mockResolvedValueOnce([
        { id: 2, date: new Date('2024-01-02'), tags: [], updatedAt: new Date('2024-01-03') }
      ])
    deps.diaryService.findByIdsForEmbedding = vi.fn(async (ids: number[]) => {
      calls++
      const id = ids[0]!
      return new Map([
        [
          id,
          {
            id,
            content: `diary-${id}`,
            date: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-02')
          }
        ]
      ])
    })
    vi.spyOn(EmbeddingAdapter.prototype, 'embedText').mockResolvedValue(undefined)

    const first = runControlledDiaryBatchEmbed(deps, { coalesceRerun: true })
    await Promise.resolve()
    const second = runControlledDiaryBatchEmbed(deps, { coalesceRerun: true })
    const [firstResult, secondResult] = await Promise.all([first, second])

    expect(firstResult).toBe(secondResult)
    expect(calls).toBe(2)
  })

  it('does not coalesce rerun after abort is requested', async () => {
    const deps = createDeps()
    let calls = 0

    vi.spyOn(EmbeddingAdapter.prototype, 'embedQuery').mockResolvedValue([0.1, 0.2, 0.3])
    deps.diaryService.listAll = vi
      .fn()
      .mockResolvedValue([
        { id: 1, date: new Date('2024-01-01'), tags: [], updatedAt: new Date('2024-01-02') }
      ])
    deps.diaryService.findByIdsForEmbedding = vi.fn(async () => {
      calls++
      return new Map([
        [
          1,
          {
            id: 1,
            content: 'diary-1',
            date: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-02')
          }
        ]
      ])
    })
    vi.spyOn(EmbeddingAdapter.prototype, 'embedText').mockImplementation(async () => {
      mobileRagOperationControl.requestAbort()
      return undefined
    })

    const shared = runControlledDiaryBatchEmbed(deps, { coalesceRerun: true })
    await Promise.resolve()
    void runControlledDiaryBatchEmbed(deps, { coalesceRerun: true }).catch(() => undefined)

    await expect(shared).rejects.toThrow('Mobile RAG operation aborted')
    expect(calls).toBe(1)
    resetMobileRagBatchStateForTests()
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
      }
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

describe('createMobileRagService.reembedAll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMobileRagBatchStateForTests()
  })

  it('clears vectors and batch embeds without hitting migration-running guard', async () => {
    const deps = createDeps()
    deps.diaryService.listAll = vi.fn().mockResolvedValue([
      { id: 1, date: new Date('2024-01-01'), tags: [], updatedAt: new Date('2024-01-02') }
    ])
    deps.diaryService.findByIdsForEmbedding = vi.fn().mockResolvedValue(
      new Map([
        [
          1,
          {
            id: 1,
            content: 'hello diary',
            date: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-02')
          }
        ]
      ])
    )

    vi.spyOn(EmbeddingAdapter.prototype, 'embedQuery').mockResolvedValue([0.1, 0.2, 0.3])
    vi.spyOn(EmbeddingAdapter.prototype, 'embedText').mockResolvedValue(undefined)

    const service = createMobileRagService(deps)
    const count = await service.reembedAll()

    expect(deps.hsRepo.clearEmbeddings).toHaveBeenCalled()
    expect(count).toBe(1)
  })

  it('defers post-sync scheduling during reembed and flushes afterward', async () => {
    const deps = createDeps()
    setMobileDiaryEmbeddingDeps(deps)
    deps.diaryService.listAll = vi.fn().mockResolvedValue([])

    let releaseDetect!: () => void
    const detectGate = new Promise<void>((resolve) => {
      releaseDetect = resolve
    })

    vi.spyOn(EmbeddingAdapter.prototype, 'embedQuery').mockImplementation(async () => {
      const { schedulePostSyncDiaryBatchEmbed } = await import(
        '../mobile-post-sync-diary-embed.service'
      )
      schedulePostSyncDiaryBatchEmbed()
      expect(isMobileRagReembedInFlight()).toBe(true)
      expect(isDeferredPostSyncEmbedPending()).toBe(true)
      await detectGate
      return [0.1, 0.2, 0.3]
    })

    const service = createMobileRagService(deps)
    const reembedPromise = service.reembedAll()
    await Promise.resolve()

    releaseDetect()
    await reembedPromise
    await new Promise((resolve) => setImmediate(resolve))

    expect(isDeferredPostSyncEmbedPending()).toBe(false)
    resetMobileRagBatchStateForTests()
  })
})
