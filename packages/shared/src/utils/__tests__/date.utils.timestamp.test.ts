import { describe, it, expect } from 'vitest'
import {
  diaryDateToSourceCreatedSeconds,
  formatStoredTimestamp,
  normalizeUnixToSeconds,
  timestampToMillis
} from '../date.utils'

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

describe('normalizeUnixToSeconds', () => {
  it('converts milliseconds to seconds for storage', () => {
    const ms = new Date(2025, 4, 11).getTime()
    expect(normalizeUnixToSeconds(ms)).toBe(Math.floor(ms / 1000))
  })
})

describe('diaryDateToSourceCreatedSeconds', () => {
  it('uses local midnight for diary calendar date', () => {
    const date = new Date(2024, 0, 15)
    expect(diaryDateToSourceCreatedSeconds(date)).toBe(Math.floor(date.getTime() / 1000))
  })
})

describe('mixed timestamp sort normalization', () => {
  it('orders 2026 ahead of 2025 and 2024 when units are mixed', () => {
    const values = [
      timestampToMillis(new Date(2025, 5, 1).getTime())!,
      timestampToMillis(new Date(2024, 0, 1).getTime())!,
      timestampToMillis(Math.floor(new Date(2026, 0, 1).getTime() / 1000))!
    ]
    const sorted = [...values].sort((a, b) => b - a)
    expect(sorted[0]).toBe(timestampToMillis(Math.floor(new Date(2026, 0, 1).getTime() / 1000)))
    expect(sorted[1]).toBe(timestampToMillis(new Date(2025, 5, 1).getTime()))
    expect(sorted[2]).toBe(timestampToMillis(new Date(2024, 0, 1).getTime()))
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
