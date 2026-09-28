import { describe, expect, it } from 'vitest'
import { EMPTY_TOKEN_USAGE, type TokenUsage } from '../useAgentStream-types'
import { applyTokenUsage, reuseEmptyAgentList, tokenUsageUnchanged } from '../useAgentStream.util'

const sample: TokenUsage = {
  inputTokens: 12,
  outputTokens: 4,
  cacheReadInputTokens: 1,
  cacheWriteInputTokens: 2,
  totalCostMicros: 30
}

describe('tokenUsageUnchanged', () => {
  it('treats equal numeric fields as unchanged', () => {
    expect(tokenUsageUnchanged(sample, { ...sample })).toBe(true)
  })

  it('detects a changed field', () => {
    expect(tokenUsageUnchanged(sample, { ...sample, outputTokens: 5 })).toBe(false)
  })
})

describe('applyTokenUsage', () => {
  it('keeps the previous object when values match', () => {
    expect(applyTokenUsage(sample, { ...sample })).toBe(sample)
  })

  it('returns the next object when values differ', () => {
    const next = { ...sample, inputTokens: 99 }
    expect(applyTokenUsage(sample, next)).toBe(next)
  })

  it('can reuse the empty usage constant', () => {
    const zeros: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0,
      totalCostMicros: 0
    }
    expect(applyTokenUsage(zeros, EMPTY_TOKEN_USAGE)).toBe(zeros)
  })
})

describe('reuseEmptyAgentList', () => {
  it('keeps the same empty array reference', () => {
    const empty: number[] = []
    expect(reuseEmptyAgentList(empty)).toBe(empty)
  })

  it('replaces a non-empty list with a new empty array', () => {
    const prev = [{ id: 1 }]
    const next = reuseEmptyAgentList(prev)
    expect(next).toEqual([])
    expect(next).not.toBe(prev)
  })
})
