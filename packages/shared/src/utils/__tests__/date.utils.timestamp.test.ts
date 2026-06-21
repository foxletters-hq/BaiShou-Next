import { describe, it, expect } from 'vitest'
import {
  diaryDateToSourceCreatedSeconds,
  formatLocalDateFromInstant,
  formatLocalDateTime,
  formatLocalTime,
  formatMessageTimestamp,
  formatRagEntryTimestamp,
  formatStoredTimestamp,
  getSummaryWeekNumber,
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

describe('formatRagEntryTimestamp', () => {
  it('shows date only for diary entries', () => {
    const ms = new Date(2026, 5, 14).getTime()
    expect(formatRagEntryTimestamp(ms, 'diary')).toBe('06/14')
  })

  it('shows date and time for non-diary entries', () => {
    const ms = new Date(2026, 5, 14, 9, 9).getTime()
    expect(formatRagEntryTimestamp(ms, 'manual')).toBe('06/14 09:09')
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

describe('formatMessageTimestamp', () => {
  it('formats Date instances in local time', () => {
    const d = new Date(2026, 5, 15, 8, 9)
    expect(formatMessageTimestamp(d)).toBe('2026-06-15 08:09')
  })
})

describe('formatLocalDateFromInstant', () => {
  it('maps instants to local calendar date', () => {
    const d = new Date(2025, 5, 21, 1, 30)
    expect(formatLocalDateFromInstant(d)).toBe('2025-06-21')
  })
})

describe('formatLocalDateTime', () => {
  it('matches formatMessageTimestamp', () => {
    const d = new Date(2026, 5, 15, 8, 9)
    expect(formatLocalDateTime(d)).toBe('2026-06-15 08:09')
  })
})

describe('formatLocalTime', () => {
  it('formats local time of day', () => {
    const d = new Date(2026, 5, 15, 8, 9, 7)
    expect(formatLocalTime(d)).toBe('08:09:07')
  })
})

describe('getSummaryWeekNumber', () => {
  it('matches summary generator week numbering', () => {
    expect(getSummaryWeekNumber(new Date(2026, 4, 18))).toBe(21)
    expect(getSummaryWeekNumber(new Date(2026, 5, 9))).toBe(24)
  })
})
