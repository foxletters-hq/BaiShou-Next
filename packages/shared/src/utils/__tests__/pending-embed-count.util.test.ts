import { describe, expect, it } from 'vitest'
import {
  buildPendingEmbedCounts,
  createPendingEmbedCountCache
} from '../pending-embed-count.util'

describe('buildPendingEmbedCounts', () => {
  it('keeps all four parts and sums them into total', () => {
    expect(
      buildPendingEmbedCounts({
        unindexedDiaryCount: 2,
        missingMemoryCount: 3,
        missingGraphNodeCount: 4,
        missingKnowledgeSourceCount: 5
      })
    ).toEqual({
      diaries: 2,
      memories: 3,
      graphNodes: 4,
      knowledgeSources: 5,
      total: 14
    })
  })

  it('clamps negatives and non-finite values the same way as nonNegativeCount', () => {
    expect(
      buildPendingEmbedCounts({
        unindexedDiaryCount: -8,
        missingMemoryCount: Number.NaN,
        missingGraphNodeCount: Number.POSITIVE_INFINITY,
        missingKnowledgeSourceCount: -2
      })
    ).toEqual({
      diaries: 0,
      memories: 0,
      graphNodes: 0,
      knowledgeSources: 0,
      total: 0
    })

    expect(
      buildPendingEmbedCounts({
        unindexedDiaryCount: Number.NEGATIVE_INFINITY,
        missingMemoryCount: 1.8,
        missingGraphNodeCount: -0.4
      })
    ).toEqual({
      diaries: 0,
      memories: 1,
      graphNodes: 0,
      knowledgeSources: 0,
      total: 1
    })
  })
})

describe('createPendingEmbedCountCache', () => {
  it('reuses the first result until invalidate', async () => {
    let calls = 0
    const cache = createPendingEmbedCountCache()
    const loader = async () => {
      calls += 1
      return buildPendingEmbedCounts({
        unindexedDiaryCount: calls,
        missingMemoryCount: 0,
        missingGraphNodeCount: 0
      })
    }

    const first = await cache.get(loader)
    const second = await cache.get(loader)
    expect(first).toEqual(second)
    expect(calls).toBe(1)

    cache.invalidate()
    const third = await cache.get(loader)
    expect(third.diaries).toBe(2)
    expect(calls).toBe(2)
  })
})
