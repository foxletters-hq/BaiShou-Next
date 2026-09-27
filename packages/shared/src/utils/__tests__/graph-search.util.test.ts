import { describe, expect, it, vi } from 'vitest'
import {
  GRAPH_SEARCH_EMBEDDING_REQUIRED_ERROR,
  isGraphSearchEmbeddingRequiredError,
  isGraphSearchMode,
  resolveGraphSearchMode,
  runGraphModeSearch
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
    expect(
      isGraphSearchEmbeddingRequiredError(new Error(GRAPH_SEARCH_EMBEDDING_REQUIRED_ERROR))
    ).toBe(true)
    expect(isGraphSearchEmbeddingRequiredError('other')).toBe(false)
  })

  it('should search by name in text mode and by vector in semantic mode', async () => {
    const searchName = vi.fn(async () => [{ id: 'name' }])
    const searchVector = vi.fn(async () => [{ id: 'vec' }])
    const embedQuery = vi.fn(async () => [1, 0])
    await expect(
      runGraphModeSearch({
        mode: 'text',
        query: '凤凰城',
        embedQuery,
        searchName,
        searchVector
      })
    ).resolves.toEqual([{ id: 'name' }])
    expect(embedQuery).not.toHaveBeenCalled()
    await expect(
      runGraphModeSearch({
        mode: 'semantic',
        query: '凤凰城',
        embedQuery,
        modelId: 'emb-1',
        searchName,
        searchVector
      })
    ).resolves.toEqual([{ id: 'vec' }])
    expect(searchVector).toHaveBeenCalledWith([1, 0], 'emb-1')
  })

  it('should require an embedder when semantic search has no embedding model', async () => {
    await expect(
      runGraphModeSearch({
        mode: 'semantic',
        query: '凤凰城',
        searchName: async () => [],
        searchVector: async () => []
      })
    ).rejects.toThrow(GRAPH_SEARCH_EMBEDDING_REQUIRED_ERROR)
  })
})
