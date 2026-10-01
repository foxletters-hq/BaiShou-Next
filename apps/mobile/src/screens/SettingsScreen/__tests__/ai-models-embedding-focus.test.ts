import { describe, expect, it } from 'vitest'
import {
  consumeAiModelsEmbeddingFocus,
  requestAiModelsEmbeddingFocus,
  resetAiModelsEmbeddingFocusForTests
} from '../ai-models-embedding-focus'

describe('ai models embedding focus', () => {
  it('should consume a pending focus request once', () => {
    resetAiModelsEmbeddingFocusForTests()
    expect(consumeAiModelsEmbeddingFocus()).toBe(false)
    requestAiModelsEmbeddingFocus()
    expect(consumeAiModelsEmbeddingFocus()).toBe(true)
    expect(consumeAiModelsEmbeddingFocus()).toBe(false)
  })
})
