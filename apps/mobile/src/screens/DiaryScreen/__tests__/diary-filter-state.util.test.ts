import { describe, expect, it, vi, beforeEach } from 'vitest'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  formatSavedMonth,
  parseSavedMonth,
  loadDiaryFilterState,
  DIARY_FILTER_STORAGE_KEYS
} from '../diary-filter-state.util'

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn()
  }
}))

describe('diary filter month persistence', () => {
  beforeEach(() => {
    vi.mocked(AsyncStorage.getItem).mockReset()
  })

  it('round-trips local month as YYYY-MM', () => {
    const june = new Date(2026, 5, 1)
    expect(formatSavedMonth(june)).toBe('2026-06')
    expect(parseSavedMonth('2026-06')).toEqual(june)
  })

  it('treats all as null', () => {
    expect(formatSavedMonth(null)).toBe('all')
    expect(parseSavedMonth('all')).toBeNull()
  })

  it('normalizes legacy ISO strings to local month start', () => {
    const parsed = parseSavedMonth('2026-05-31T16:00:00.000Z')
    expect(parsed).toEqual(new Date(2026, 5, 1))
  })

  it('restores month filter at page 1 even when saved page is higher', async () => {
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key) => {
      if (key === DIARY_FILTER_STORAGE_KEYS.selectedMonth) return '2026-06'
      if (key === DIARY_FILTER_STORAGE_KEYS.currentPage) return '2'
      return null
    })

    const state = await loadDiaryFilterState()
    expect(state.selectedMonth).toEqual(new Date(2026, 5, 1))
    expect(state.currentPage).toBe(1)
  })

  it('restores saved page for all-diaries view', async () => {
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key) => {
      if (key === DIARY_FILTER_STORAGE_KEYS.selectedMonth) return 'all'
      if (key === DIARY_FILTER_STORAGE_KEYS.currentPage) return '2'
      return null
    })

    const state = await loadDiaryFilterState()
    expect(state.selectedMonth).toBeNull()
    expect(state.currentPage).toBe(2)
  })
})
