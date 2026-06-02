import { describe, it, expect } from 'vitest'
import { formatStoredTimestamp, timestampToMillis } from '../date.utils'

describe('timestampToMillis', () => {
  it('converts unix seconds to milliseconds', () => {
    const sec = Math.floor(new Date('2025-05-11T12:00:00').getTime() / 1000)
    expect(timestampToMillis(sec)).toBe(sec * 1000)
  })

  it('keeps millisecond values unchanged', () => {
    const ms = new Date('2026-02-27T10:30:00').getTime()
    expect(timestampToMillis(ms)).toBe(ms)
  })
})

describe('formatStoredTimestamp', () => {
  it('formats seconds-based diary index timestamps correctly', () => {
    const sec = Math.floor(new Date('2025-05-11T21:37:00').getTime() / 1000)
    const formatted = formatStoredTimestamp(sec)
    expect(formatted).toMatch(/^2025-05-11 21:37/)
  })

  it('returns undefined for epoch noise', () => {
    expect(formatStoredTimestamp(1_740_000)).toBeUndefined()
  })
})
