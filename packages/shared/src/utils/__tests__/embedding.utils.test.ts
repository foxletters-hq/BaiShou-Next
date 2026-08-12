import { describe, expect, it } from 'vitest'
import {
  isChatModelForConnectionTest,
  isEmbeddingModel,
  mergeZhipuKnownEmbeddingModels,
  ZHIPU_KNOWN_EMBEDDING_MODELS
} from '../embedding.utils'

describe('embedding.utils connection test helpers', () => {
  it('detects embedding models from siliconflow-style ids', () => {
    expect(isEmbeddingModel('Qwen/Qwen3-Embedding-8B')).toBe(true)
    expect(isEmbeddingModel('BAAI/bge-m3')).toBe(true)
    expect(isChatModelForConnectionTest('Qwen/Qwen3-Embedding-8B')).toBe(false)
    expect(isChatModelForConnectionTest('BAAI/bge-m3')).toBe(false)
  })

  it('allows dialogue models for connection test', () => {
    expect(isChatModelForConnectionTest('deepseek-ai/DeepSeek-V4-Pro')).toBe(true)
    expect(isChatModelForConnectionTest('gpt-4o')).toBe(true)
  })

  it('recognizes zhipu known embedding ids', () => {
    for (const id of ZHIPU_KNOWN_EMBEDDING_MODELS) {
      expect(isEmbeddingModel(id)).toBe(true)
    }
  })
})

describe('mergeZhipuKnownEmbeddingModels', () => {
  it('appends missing embedding seeds after remote chat models', () => {
    expect(mergeZhipuKnownEmbeddingModels(['glm-4', 'glm-4-flash'])).toEqual([
      'glm-4',
      'glm-4-flash',
      'embedding-2',
      'embedding-3'
    ])
  })

  it('does not duplicate seeds already present in remote list', () => {
    expect(mergeZhipuKnownEmbeddingModels(['glm-4', 'embedding-3', 'embedding-2'])).toEqual([
      'glm-4',
      'embedding-3',
      'embedding-2'
    ])
  })

  it('deduplicates remote ids and still fills missing seeds', () => {
    expect(mergeZhipuKnownEmbeddingModels(['glm-4', 'glm-4', 'embedding-2'])).toEqual([
      'glm-4',
      'embedding-2',
      'embedding-3'
    ])
  })
})
