import { describe, expect, it } from 'vitest'
import { buildPendingEmbedCounts } from '../pending-embed-count.util'

describe('buildPendingEmbedCounts', () => {
  it('keeps all three parts and sums them into total', () => {
    expect(
      buildPendingEmbedCounts({
        unindexedDiaryCount: 2,
        missingMemoryCount: 3,
        missingGraphNodeCount: 4
      })
    ).toEqual({
      diaries: 2,
      memories: 3,
      graphNodes: 4,
      total: 9
    })
  })

  it('clamps negatives and non-finite values the same way as nonNegativeCount', () => {
    expect(
      buildPendingEmbedCounts({
        unindexedDiaryCount: -8,
        missingMemoryCount: Number.NaN,
        missingGraphNodeCount: Number.POSITIVE_INFINITY
      })
    ).toEqual({
      diaries: 0,
      memories: 0,
      graphNodes: 0,
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
      total: 1
    })
  })
})
