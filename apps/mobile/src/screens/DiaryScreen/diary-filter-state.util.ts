import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  WEATHER_IDS,
  normalizeWeatherId,
  normalizeMoodIdForFilter,
  type WeatherId,
  type MoodId
} from '@baishou/shared'

export const DEFAULT_DIARY_PAGE_SIZE = 10
export const DIARY_PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 80, 100] as const

export const DIARY_FILTER_STORAGE_KEYS = {
  searchQuery: 'diary_searchQuery',
  selectedMonth: 'diary_selectedMonth',
  filterWeathers: 'diary_filterWeathers',
  filterMoods: 'diary_filterMoods',
  filterFavorite: 'diary_filterFavorite',
  currentPage: 'diary_currentPage',
  pageSize: 'diary_pageSize'
} as const

export type DiaryFilterState = {
  restored: boolean
  searchQuery: string
  selectedMonth: Date | null
  filterWeathers: string[]
  filterMoods: string[]
  filterFavorite: boolean
  currentPage: number
  pageSize: number
}

/** 将月份筛选持久化为本地 YYYY-MM，避免 toISOString 的时区偏移 */
export function formatSavedMonth(month: Date | null): string {
  if (!month) return 'all'
  const year = month.getFullYear()
  const monthIndex = month.getMonth() + 1
  return `${year}-${String(monthIndex).padStart(2, '0')}`
}

/** 解析持久化的月份筛选；兼容历史 ISO 字符串 */
export function parseSavedMonth(saved: string | null): Date | null {
  if (!saved || saved === 'all') return null

  const yearMonthMatch = /^(\d{4})-(\d{2})$/.exec(saved)
  if (yearMonthMatch) {
    const year = Number(yearMonthMatch[1])
    const month = Number(yearMonthMatch[2])
    if (year >= 1970 && month >= 1 && month <= 12) {
      return new Date(year, month - 1, 1)
    }
  }

  try {
    const parsed = new Date(saved)
    if (!isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), 1)
    }
  } catch {
    /* ignore */
  }

  return null
}

function parseFilterWeathers(saved: string | null): string[] {
  if (!saved) return []
  try {
    const parsed = JSON.parse(saved) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((w) => normalizeWeatherId(String(w)))
      .filter((w): w is WeatherId => (WEATHER_IDS as readonly string[]).includes(w))
  } catch {
    return []
  }
}

function parseFilterMoods(saved: string | null): string[] {
  if (!saved) return []
  try {
    const parsed = JSON.parse(saved) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((m) => normalizeMoodIdForFilter(String(m)))
      .filter((m): m is MoodId => m != null)
  } catch {
    return []
  }
}

export function createDefaultDiaryFilterState(restored = false): DiaryFilterState {
  return {
    restored,
    searchQuery: '',
    selectedMonth: null,
    filterWeathers: [],
    filterMoods: [],
    filterFavorite: false,
    currentPage: 1,
    pageSize: DEFAULT_DIARY_PAGE_SIZE
  }
}

export async function loadDiaryFilterState(): Promise<DiaryFilterState> {
  const [
    savedQuery,
    savedMonth,
    savedWeathers,
    savedMoods,
    savedFavorite,
    savedPage,
    savedPageSize
  ] = await Promise.all([
    AsyncStorage.getItem(DIARY_FILTER_STORAGE_KEYS.searchQuery),
    AsyncStorage.getItem(DIARY_FILTER_STORAGE_KEYS.selectedMonth),
    AsyncStorage.getItem(DIARY_FILTER_STORAGE_KEYS.filterWeathers),
    AsyncStorage.getItem(DIARY_FILTER_STORAGE_KEYS.filterMoods),
    AsyncStorage.getItem(DIARY_FILTER_STORAGE_KEYS.filterFavorite),
    AsyncStorage.getItem(DIARY_FILTER_STORAGE_KEYS.currentPage),
    AsyncStorage.getItem(DIARY_FILTER_STORAGE_KEYS.pageSize)
  ])

  const state = createDefaultDiaryFilterState(true)

  if (savedMonth != null) state.selectedMonth = parseSavedMonth(savedMonth)
  state.filterWeathers = parseFilterWeathers(savedWeathers)
  state.filterMoods = parseFilterMoods(savedMoods)
  if (savedFavorite === 'true') state.filterFavorite = true

  // 搜索词仅会话内有效，不恢复历史持久化（兼容清理旧数据）
  if (savedQuery) {
    void AsyncStorage.removeItem(DIARY_FILTER_STORAGE_KEYS.searchQuery).catch(() => {})
  }

  if (state.selectedMonth == null && savedPage) {
    const page = Number(savedPage)
    if (!isNaN(page) && page >= 1) state.currentPage = page
  }

  if (savedPageSize) {
    const size = Number(savedPageSize)
    if (!isNaN(size) && (DIARY_PAGE_SIZE_OPTIONS as readonly number[]).includes(size)) {
      state.pageSize = size
    }
  }

  return state
}

let prefetchedFilterState: DiaryFilterState | null = null
let prefetchPromise: Promise<DiaryFilterState> | null = null

export function prefetchDiaryFilterState(): Promise<DiaryFilterState> {
  if (prefetchedFilterState) return Promise.resolve(prefetchedFilterState)
  if (!prefetchPromise) {
    prefetchPromise = loadDiaryFilterState()
      .then((state) => {
        prefetchedFilterState = state
        return state
      })
      .catch(() => {
        const fallback = createDefaultDiaryFilterState(true)
        prefetchedFilterState = fallback
        return fallback
      })
  }
  return prefetchPromise
}

export function getPrefetchedDiaryFilterState(): DiaryFilterState | null {
  return prefetchedFilterState
}

void prefetchDiaryFilterState()
