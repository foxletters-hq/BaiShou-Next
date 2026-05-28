import { describe, expect, it } from 'vitest'
import { isChatModelForConnectionTest, isEmbeddingModel } from '../embedding.utils'

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
})
