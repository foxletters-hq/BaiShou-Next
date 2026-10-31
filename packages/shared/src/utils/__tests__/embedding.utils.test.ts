import { describe, expect, it } from 'vitest'
import {
  isChatModelForConnectionTest,
  isEmbeddingModel,
  mergeZhipuKnownEmbeddingModels,
  normalizeModelId,
  normalizeRemoteModelIds,
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

describe('normalizeModelId', () => {
  it('strips jina-ai/ prefix for Jina models', () => {
    expect(normalizeModelId('jina-ai/jina-embeddings-v3')).toBe('jina-embeddings-v3')
    expect(normalizeModelId('jina-ai/jina-clip-v2')).toBe('jina-clip-v2')
    expect(normalizeModelId('jina-ai/reader-lm-1.5b')).toBe('reader-lm-1.5b')
  })

  it('strips models/ prefix for Gemini models', () => {
    expect(normalizeModelId('models/gemini-2.0-flash')).toBe('gemini-2.0-flash')
    expect(normalizeModelId('models/text-embedding-004')).toBe('text-embedding-004')
  })

  it('preserves namespaced models for providers that require them', () => {
    expect(normalizeModelId('BAAI/bge-m3')).toBe('BAAI/bge-m3')
    expect(normalizeModelId('Pro/BAAI/bge-m3')).toBe('Pro/BAAI/bge-m3')
    expect(normalizeModelId('meta-llama/Llama-3.3-70B-Instruct')).toBe(
      'meta-llama/Llama-3.3-70B-Instruct'
    )
    expect(normalizeModelId('text-embedding-3-small')).toBe('text-embedding-3-small')
  })

  it('handles empty or whitespace strings gracefully', () => {
    expect(normalizeModelId('')).toBe('')
    expect(normalizeModelId('  jina-ai/jina-embeddings-v3  ')).toBe('jina-embeddings-v3')
  })
})

describe('normalizeRemoteModelIds', () => {
  it('normalizes prefixes and deduplicates while maintaining order', () => {
    const raw = [
      'jina-ai/jina-embeddings-v3',
      'jina-embeddings-v3',
      'jina-ai/jina-clip-v2',
      'BAAI/bge-m3',
      'models/gemini-2.0-flash'
    ]
    expect(normalizeRemoteModelIds(raw)).toEqual([
      'jina-embeddings-v3',
      'jina-clip-v2',
      'BAAI/bge-m3',
      'gemini-2.0-flash'
    ])
  })
})
