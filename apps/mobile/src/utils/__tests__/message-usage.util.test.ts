import { describe, it, expect } from 'vitest'
import { formatCompactTokenCount, messageHasUsageStats } from '../message-usage.util'

describe('messageHasUsageStats', () => {
  it('returns false when all usage fields are empty or zero', () => {
    expect(messageHasUsageStats({})).toBe(false)
    expect(
      messageHasUsageStats({
        inputTokens: 0,
        outputTokens: 0,
        costMicros: 0,
        cacheReadInputTokens: 0,
        cacheWriteInputTokens: 0
      })
    ).toBe(false)
  })

  it('returns true when any usage field is positive', () => {
    expect(messageHasUsageStats({ outputTokens: 12 })).toBe(true)
    expect(messageHasUsageStats({ costMicros: 1 })).toBe(true)
    expect(messageHasUsageStats({ cacheReadInputTokens: 100 })).toBe(true)
    expect(messageHasUsageStats({ cacheWriteInputTokens: 50 })).toBe(true)
  })
})

describe('formatCompactTokenCount', () => {
  it('formats values below 1000 as plain numbers', () => {
    expect(formatCompactTokenCount(0)).toBe('0')
    expect(formatCompactTokenCount(999)).toBe('999')
  })

  it('formats values at or above 1000 with one decimal k suffix', () => {
    expect(formatCompactTokenCount(1000)).toBe('1.0k')
    expect(formatCompactTokenCount(1234)).toBe('1.2k')
  })
})
