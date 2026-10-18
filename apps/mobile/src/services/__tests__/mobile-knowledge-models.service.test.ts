import { describe, expect, it, vi, beforeEach } from 'vitest'
import { agentDbRuntimeRef } from '../mobile-agent-db-runtime-ref'
import {
  mobileGetKnowledgeProcessLabels,
  mobileSetGlobalKnowledgeModel,
  peekCachedKnowledgeProcessLabels
} from '../mobile-knowledge-models.service'

describe('mobile-knowledge-models.service caching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('caches knowledge process labels in memory and reads without delay', async () => {
    const mockSettings = {
      get: vi.fn().mockImplementation(async (key: string) => {
        if (key === 'global_models') {
          return {
            globalEmbeddingProviderId: 'openai',
            globalEmbeddingModelId: 'text-embedding-3-small',
            globalGraphProviderId: 'openai',
            globalGraphModelId: 'gpt-4o'
          }
        }
        return null
      }),
      set: vi.fn().mockResolvedValue(undefined)
    }

    agentDbRuntimeRef.current = {
      settingsManager: mockSettings as never
    } as never

    const labels = await mobileGetKnowledgeProcessLabels()
    expect(labels.embeddingModelLabel).toBe('text-embedding-3-small')
    expect(labels.graphModelLabel).toBe('gpt-4o')

    // 内存同步缓存已生成
    const cached = peekCachedKnowledgeProcessLabels()
    expect(cached).toEqual({
      embeddingModelId: 'text-embedding-3-small',
      embeddingModelLabel: 'text-embedding-3-small',
      graphModelLabel: 'gpt-4o',
      embeddingProviderId: 'openai',
      graphProviderId: 'openai'
    })

    // 设置新模型时同步刷新缓存
    await mobileSetGlobalKnowledgeModel({
      field: 'embedding',
      providerId: 'ollama',
      modelId: 'nomic-embed-text'
    })

    const updatedCached = peekCachedKnowledgeProcessLabels()
    expect(updatedCached?.embeddingModelLabel).toBe('nomic-embed-text')
  })
})
