import { describe, expect, it } from 'vitest'
import { enrichMobileEntry, loadMetadataMap, newMemoryId } from '../mobile-rag-entry.helpers'

describe('enrichMobileEntry', () => {
  it('should mark a memory row as manual when sourceSessionId is null', () => {
    const entry = enrichMobileEntry({
      embeddingId: 'e1',
      text: 'hello',
      createdAt: 1000,
      sourceType: 'memory',
      sourceId: 'm1',
      metadataJson: JSON.stringify({ sourceSessionId: null, tags: ['a'], createdAt: 2000 })
    })
    expect(entry.isManual).toBe(true)
    expect(entry.sourceSessionId).toBeNull()
    expect(entry.tags).toEqual(['a'])
    expect(entry.createdAt).toBe(2000)
  })

  it('should leave diary rows without a sourceSessionId when they are not memory-like', () => {
    const entry = enrichMobileEntry({
      embeddingId: 'e2',
      text: 'diary',
      createdAt: 1000,
      sourceType: 'diary',
      sourceId: 'd1'
    })
    expect(entry.isManual).toBe(false)
    expect(entry.sourceSessionId).toBeUndefined()
    expect(entry.createdAt).toBe(1000)
  })
})

describe('loadMetadataMap', () => {
  it('should return an empty map when the client or id list is missing', async () => {
    expect(await loadMetadataMap(undefined, ['e1'])).toEqual(new Map())
    expect(await loadMetadataMap({ execute: async () => ({ rows: [] }) }, [])).toEqual(new Map())
  })
})

describe('newMemoryId', () => {
  it('should return a non-empty id when generating a memory row', () => {
    expect(newMemoryId().length).toBeGreaterThan(4)
  })
})
