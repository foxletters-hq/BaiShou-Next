import { describe, expect, it } from 'vitest'
import { formatDiaryDateStr, mapDiaryListEntries } from '../diary-list-display.util'

describe('formatDiaryDateStr', () => {
  it('should format a date as YYYY-MM-DD when given a calendar day', () => {
    expect(formatDiaryDateStr(new Date(2026, 8, 18))).toBe('2026-09-18')
  })
})

describe('mapDiaryListEntries', () => {
  it('should return an empty list when entries are missing', () => {
    expect(mapDiaryListEntries(undefined)).toEqual([])
    expect(mapDiaryListEntries([])).toEqual([])
  })

  it('should prefer the diary date and fall back to createdAt when mapping a row', () => {
    const [row] = mapDiaryListEntries([
      {
        id: 1,
        date: '2026-09-18',
        content: 'hello world',
        preview: 'hello'
      }
    ])
    expect(row?.id).toBe(1)
    expect(row?.preview).toBe('hello')
    expect(row?.date.getFullYear()).toBe(2026)
  })
})
