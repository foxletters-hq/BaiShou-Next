import { describe, expect, it } from 'vitest'
import { estimateExtractionCost } from '../graph-llm-extraction.service'
import { splitEntityQuery } from '../graph-rag.service'

describe('estimateExtractionCost', () => {
  it('returns zeros for empty pending list', () => {
    const e = estimateExtractionCost(0)
    expect(e.entryCount).toBe(0)
    expect(e.estimatedTokens).toBe(0)
  })

  it('overestimates tokens and minutes for a batch', () => {
    const e = estimateExtractionCost(128)
    expect(e.entryCount).toBe(128)
    expect(e.estimatedTokens).toBe(128 * 600)
    expect(e.estimatedYuanHigh).toBeGreaterThanOrEqual(e.estimatedYuanLow)
    expect(e.estimatedMinutesHigh).toBeGreaterThanOrEqual(e.estimatedMinutesLow)
    expect(e.estimatedMinutesLow).toBeGreaterThanOrEqual(1)
  })
})

describe('splitEntityQuery', () => {
  it('keeps a single entity intact', () => {
    expect(splitEntityQuery('小明')).toEqual(['小明'])
  })

  it('splits compound Chinese / English connectors', () => {
    expect(splitEntityQuery('小明和杭州')).toEqual(['小明', '杭州'])
    expect(splitEntityQuery('Alice and Bob')).toEqual(['Alice', 'Bob'])
    expect(splitEntityQuery('A、B、C')).toEqual(['A', 'B', 'C'])
  })
})
