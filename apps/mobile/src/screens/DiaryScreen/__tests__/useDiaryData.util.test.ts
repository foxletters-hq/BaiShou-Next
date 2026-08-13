import { describe, expect, it } from 'vitest'
import { reuseEmptyDiaryEntries } from '../diary-list-entries.util'
import { shouldDiaryListLoadSilently } from '../diary-list-load.util'

describe('shouldDiaryListLoadSilently', () => {
  it('uses explicit silent when provided', () => {
    expect(shouldDiaryListLoadSilently(true, false, true)).toBe(true)
    expect(shouldDiaryListLoadSilently(true, false, false)).toBe(false)
  })

  it('blocks silent refresh after browse identity change', () => {
    expect(shouldDiaryListLoadSilently(true, true)).toBe(false)
  })

  it('allows silent refresh when cache exists and browse unchanged', () => {
    expect(shouldDiaryListLoadSilently(true, false)).toBe(true)
  })

  it('blocks silent refresh when cache is empty', () => {
    expect(shouldDiaryListLoadSilently(false, false)).toBe(false)
  })
})

describe('reuseEmptyDiaryEntries', () => {
  it('keeps the same empty array reference', () => {
    const empty: number[] = []
    expect(reuseEmptyDiaryEntries(empty)).toBe(empty)
  })

  it('replaces a non-empty list with a new empty array', () => {
    const prev = [{ id: 1 }]
    const next = reuseEmptyDiaryEntries(prev)
    expect(next).toEqual([])
    expect(next).not.toBe(prev)
  })
})
