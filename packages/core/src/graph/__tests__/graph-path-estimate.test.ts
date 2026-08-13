import { describe, expect, it } from 'vitest'
import {
  estimateExtractionCost,
  estimateTokensForDiaryChars,
  entryNodeIdForFilePath,
  legacyEntryNodeIdForFilePath
} from '../graph-llm-extraction.service'
import { splitEntityQuery } from '../graph-rag.service'

describe('estimateExtractionCost', () => {
  it('returns zeros for empty pending list', () => {
    const e = estimateExtractionCost(0)
    expect(e.entryCount).toBe(0)
    expect(e.estimatedTokens).toBe(0)
    expect(e.estimatedMinutesLow).toBe(0)
  })

  it('uses floor×count when char lengths unknown', () => {
    const e = estimateExtractionCost(128)
    expect(e.entryCount).toBe(128)
    expect(e.estimatedTokens).toBe(Math.ceil(128 * 600 * 1.25))
    expect(e.estimatedUsdHigh).toBeGreaterThanOrEqual(e.estimatedUsdLow)
    expect(e.estimatedMinutesHigh).toBeGreaterThanOrEqual(e.estimatedMinutesLow)
    expect(e.estimatedMinutesLow).toBeGreaterThanOrEqual(1)
  })

  it('overestimates from char counts (max floor, ceil chars/2)', () => {
    expect(estimateTokensForDiaryChars(100)).toBe(600)
    expect(estimateTokensForDiaryChars(2000)).toBe(1000)
    const e = estimateExtractionCost(2, { charCounts: [100, 2000] })
    // (600 + 1000) * 1.25
    expect(e.estimatedTokens).toBe(Math.ceil(1600 * 1.25))
  })
})

describe('entryNodeIdForFilePath vault salt', () => {
  it('is stable for path without vault', () => {
    const a = entryNodeIdForFilePath('Journals/2026-07-01.md')
    const b = entryNodeIdForFilePath('Journals\\2026-07-01.md')
    expect(a).toBe(b)
    expect(a).toBe(legacyEntryNodeIdForFilePath('Journals/2026-07-01.md'))
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('differs across vaults for the same path', () => {
    const path = 'Journals/2026-07-01.md'
    const a = entryNodeIdForFilePath(path, 'vlt_aaaaaaaaaaaaaaaa')
    const b = entryNodeIdForFilePath(path, 'vlt_bbbbbbbbbbbbbbbb')
    expect(a).not.toBe(b)
    expect(a).not.toBe(legacyEntryNodeIdForFilePath(path))
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
