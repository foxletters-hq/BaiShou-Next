import { describe, expect, it } from 'vitest'
import {
  GRAPH_SEARCH_EMBEDDING_REQUIRED_ERROR,
  isGraphSearchEmbeddingRequiredError,
  isGraphSearchMode,
  resolveGraphSearchMode
} from '../graph-search.util'

describe('graph-search.util', () => {
  it('accepts only text and semantic modes', () => {
    expect(isGraphSearchMode('text')).toBe(true)
    expect(isGraphSearchMode('semantic')).toBe(true)
    expect(isGraphSearchMode('hybrid')).toBe(false)
    expect(resolveGraphSearchMode(undefined)).toBe('text')
    expect(resolveGraphSearchMode('semantic')).toBe('semantic')
  })

  it('detects the embedding-required error code', () => {
    expect(isGraphSearchEmbeddingRequiredError(new Error(GRAPH_SEARCH_EMBEDDING_REQUIRED_ERROR))).toBe(
      true
    )
    expect(isGraphSearchEmbeddingRequiredError('other')).toBe(false)
  })
})
