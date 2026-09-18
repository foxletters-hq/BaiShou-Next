import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmbeddingAdapter } from '@baishou/ai'
import { runControlledDiaryBatchEmbedCore } from '../mobile-rag-batch-embed.helpers'
import { runMobileManualPendingEmbedFill } from '../mobile-pending-embed-fill'
import { resetMobileRagBatchStateForTests } from '../mobile-rag-state.helpers'
import { mobileRagOperationControl } from '../mobile-rag-operation-control'
import type { MobileRagServiceDeps } from '../mobile-rag-core.helpers'

vi.mock('../mobile-pending-embed-fill', () => ({
  runMobileManualPendingEmbedFill: vi.fn()
}))

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
