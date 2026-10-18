import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmbeddingAdapter } from '@baishou/ai'
import { runControlledDiaryBatchEmbedCore } from '../mobile-rag-batch-embed.helpers'
import { runMobileManualPendingEmbedFill } from '../mobile-pending-embed-fill'
import { resetMobileRagBatchStateForTests } from '../mobile-rag-state.helpers'
import { mobileRagOperationControl } from '../mobile-rag-operation-control'
import { listVaultDiaryMetas } from '../mobile-rag-vault-diary'
import type { MobileRagServiceDeps } from '../mobile-rag-core.helpers'

vi.mock('../mobile-pending-embed-fill', () => ({
  runMobileManualPendingEmbedFill: vi.fn()
}))

vi.mock('../mobile-pending-embed-counts', () => ({
  getOrganizePendingSnapshot: vi.fn().mockResolvedValue({
    diaries: 0,
    memories: 0,
    graphNodes: 0,
    knowledgeSources: 0,
    notebookGraphNodes: 0,
    total: 0,
    graphExtract: 0,
    graphDisambiguate: 0
  }),
  invalidateMobilePendingEmbedCountsCache: vi.fn(),
  notifyMobilePendingEmbedCountsChanged: vi.fn()
}))

vi.mock('../mobile-rag-vault-diary', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../mobile-rag-vault-diary')>()
  return {
    ...actual,
    listVaultDiaryMetas: vi.fn().mockResolvedValue([]),
    loadVaultDiariesForEmbedding: vi.fn().mockResolvedValue(new Map())
  }
})

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
      listForEmbedDetection: vi.fn().mockResolvedValue([]),
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
      execute: vi.fn().mockResolvedValue({ rows: [{ count: 0 }] })
    },
    ...overrides
  } as MobileRagServiceDeps
}

describe('runControlledDiaryBatchEmbedCore when diary backlog is zero', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMobileRagBatchStateForTests()
    mobileRagOperationControl.reset()
    vi.mocked(runMobileManualPendingEmbedFill).mockResolvedValue({
      graphUpdated: 0,
      graphFailed: 0,
      graphTotal: 0,
      skippedReason: 'nothing-to-embed'
    })
  })

  it('should still call pending fill when diary backlog is zero', async () => {
    const deps = createDeps()
    vi.spyOn(EmbeddingAdapter.prototype, 'embedQuery').mockResolvedValue([0.1, 0.2, 0.3])

    const result = await runControlledDiaryBatchEmbedCore(deps)

    expect(runMobileManualPendingEmbedFill).toHaveBeenCalledTimes(1)
    expect(result.skipped).toBe(true)
    expect(result.skipReason).toBe('nothing-to-embed')
  })

  it('should not skip as nothing-to-embed when fill still has pending work', async () => {
    vi.mocked(runMobileManualPendingEmbedFill).mockResolvedValue({
      graphUpdated: 2,
      graphFailed: 0,
      graphTotal: 2
    })
    const deps = createDeps()
    vi.spyOn(EmbeddingAdapter.prototype, 'embedQuery').mockResolvedValue([0.1, 0.2, 0.3])

    const result = await runControlledDiaryBatchEmbedCore(deps)

    expect(runMobileManualPendingEmbedFill).toHaveBeenCalledTimes(1)
    expect(result.skipped).toBe(false)
    expect(result.skipReason).toBeUndefined()
  })
})

describe('runControlledDiaryBatchEmbedCore when a shadow index is connected', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMobileRagBatchStateForTests()
    mobileRagOperationControl.reset()
    vi.mocked(runMobileManualPendingEmbedFill).mockResolvedValue({
      graphUpdated: 0,
      graphFailed: 0,
      graphTotal: 0,
      skippedReason: 'nothing-to-embed'
    })
  })

  it('should embed live vault diaries instead of an empty shadow index', async () => {
    const deps = createDeps({
      vaultScope: {
        resolveActiveVaultName: async () => 'Personal',
        resolveActiveVaultId: async () => 'Personal',
        resolveVaultIdByName: async () => 'Personal',
        listVaultNames: async () => ['Personal'],
        listVaultEntries: async () => [{ id: 'Personal', name: 'Personal' }],
        getShadowDb: () => ({}) as never
      }
    })
    deps.diaryService.listForEmbedDetection = vi
      .fn()
      .mockResolvedValue([
        { id: 1, date: new Date('2024-01-01'), tags: [], updatedAt: new Date('2024-01-02') }
      ])
    deps.diaryService.findByIdsForEmbedding = vi.fn().mockResolvedValue(
      new Map([
        [
          1,
          {
            id: 1,
            content: 'diary-1',
            date: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-02'),
            isFavorite: false,
            mediaPaths: []
          }
        ]
      ])
    )
    vi.spyOn(EmbeddingAdapter.prototype, 'embedQuery').mockResolvedValue([0.1, 0.2, 0.3])
    vi.spyOn(EmbeddingAdapter.prototype, 'embedText').mockResolvedValue(undefined)

    const result = await runControlledDiaryBatchEmbedCore(deps)

    expect(deps.diaryService.listForEmbedDetection).toHaveBeenCalled()
    expect(deps.diaryService.findByIdsForEmbedding).toHaveBeenCalled()
    expect(listVaultDiaryMetas).not.toHaveBeenCalled()
    expect(result.skipped).toBe(false)
    expect(result.total).toBe(1)
  })
})
