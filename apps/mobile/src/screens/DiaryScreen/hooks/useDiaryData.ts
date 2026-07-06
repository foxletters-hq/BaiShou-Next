import { useState, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { logger } from '@baishou/shared'
import type { DiaryListFilter } from '@baishou/shared'
import type { DiaryService } from '@baishou/core-mobile'
import { getDiaryListCacheVersion, subscribeDiaryListCache, subscribeDiaryListSavedPatch } from '@baishou/shared/cache'
import { useNativeToast } from '@baishou/ui/native'
import { shouldDiaryListLoadSilently } from '../diary-list-load.util'
import { diaryListEntriesUnchanged } from '../diary-list-entries.util'
import { applyDiaryListSavedPatch } from '../diary-list-saved-patch.util'

export interface DiaryPageQuery {
  selectedMonth: Date | null
  searchQuery: string
  filterWeathers: string[]
  filterMoods: string[]
  filterFavorite: boolean
  page: number
  pageSize: number
}

export interface DiaryListEntryData {
  id: number
  date: Date | string
  content: string
  tags: string[]
  preview: string
  weather?: string
  mood?: string
  location?: string
  isFavorite?: boolean
  tagColors?: Record<string, number>
  createdAt?: Date | string
  updatedAt?: Date | string
}

export interface UseDiaryDataOptions {
  ready?: boolean
  vaultRevision?: number
  ecosystemResyncEpoch?: number
  /** 列表页失焦（如打开编辑器）时跳过后台刷新，避免 FlatList 跳动 */
  isScreenFocused?: boolean
}

export interface LoadDiaryEntriesOptions {
  /** 有缓存时后台刷新，不触发全屏 loading */
  silent?: boolean
}

const SEARCH_DEBOUNCE_MS = 500

function buildListFilter(query: DiaryPageQuery): DiaryListFilter {
  const filter: DiaryListFilter = {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    orderBy: 'desc'
  }

  if (query.selectedMonth) {
    filter.year = query.selectedMonth.getFullYear()
    filter.month = query.selectedMonth.getMonth() + 1
  }

  if (query.filterFavorite) {
    filter.favorite = true
  }

  if (query.filterWeathers.length > 0) {
    filter.weathers = query.filterWeathers
  }

  if (query.filterMoods.length > 0) {
    filter.moods = query.filterMoods
  }

  return filter
}

/** 搜索模式：跨月全文检索，仅保留天气/心情/收藏筛选 */
function buildSearchFilter(
  query: DiaryPageQuery
): Omit<DiaryListFilter, 'limit' | 'offset' | 'orderBy'> {
  const filter: Omit<DiaryListFilter, 'limit' | 'offset' | 'orderBy'> = {}

  if (query.filterFavorite) {
    filter.favorite = true
  }

  if (query.filterWeathers.length > 0) {
    filter.weathers = query.filterWeathers
  }

  if (query.filterMoods.length > 0) {
    filter.moods = query.filterMoods
  }

  return filter
}

function buildCountFilter(query: DiaryPageQuery): Omit<DiaryListFilter, 'limit' | 'offset'> {
  const { limit: _l, offset: _o, orderBy: _ob, ...rest } = buildListFilter(query)
  return rest
}

function searchFilterCacheKey(
  filter: Omit<DiaryListFilter, 'limit' | 'offset' | 'orderBy'>
): string {
  return `${filter.favorite ? 1 : 0}:${(filter.weathers ?? []).join(',')}:${(filter.moods ?? []).join(',')}`
}

function matchesSelectedMonth(dateValue: Date | string, selectedMonth: Date): boolean {
  const parsed = new Date(dateValue)
  if (isNaN(parsed.getTime())) return false
  return (
    parsed.getFullYear() === selectedMonth.getFullYear() &&
    parsed.getMonth() === selectedMonth.getMonth()
  )
}

export function useDiaryData(
  diaryService: DiaryService | undefined,
  query: DiaryPageQuery,
  options: UseDiaryDataOptions = {}
) {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const { ready = true, vaultRevision = 0, ecosystemResyncEpoch = 0, isScreenFocused = true } =
    options
  const [entries, setEntries] = useState<DiaryListEntryData[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const loadRequestIdRef = useRef(0)
  const entriesRef = useRef<DiaryListEntryData[]>([])
  entriesRef.current = entries
  const readyRef = useRef(ready)
  readyRef.current = ready
  const queryRef = useRef(query)
  queryRef.current = query
  const diaryListCacheVersion = useSyncExternalStore(
    subscribeDiaryListCache,
    getDiaryListCacheVersion
  )

  useEffect(() => {
    return subscribeDiaryListSavedPatch((patch) => {
      setEntries((prev) => {
        const next = applyDiaryListSavedPatch(prev, patch)
        return next ?? prev
      })
    })
  }, [])

  const rawSearchTerm = query.searchQuery.trim()
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(rawSearchTerm)
  const debouncedSearchTermRef = useRef(debouncedSearchTerm)
  debouncedSearchTermRef.current = debouncedSearchTerm

  useEffect(() => {
    if (!rawSearchTerm) {
      setDebouncedSearchTerm('')
      return
    }
    const timer = setTimeout(() => setDebouncedSearchTerm(rawSearchTerm), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [rawSearchTerm])

  const effectiveQuery = useMemo(
    (): DiaryPageQuery => ({
      ...query,
      searchQuery: debouncedSearchTerm
    }),
    [query, debouncedSearchTerm]
  )

  const listFilter = useMemo(() => buildListFilter(effectiveQuery), [effectiveQuery])
  const countFilter = useMemo(() => buildCountFilter(effectiveQuery), [effectiveQuery])
  const browseMonthKey = effectiveQuery.selectedMonth?.getTime() ?? 0
  const searchFilterKey = useMemo(
    () => searchFilterCacheKey(buildSearchFilter(effectiveQuery)),
    [effectiveQuery.filterFavorite, effectiveQuery.filterWeathers, effectiveQuery.filterMoods]
  )

  const browseIdentity = useMemo(
    () =>
      `${browseMonthKey}:${query.page}:${query.pageSize}:${searchFilterKey}:${debouncedSearchTerm}`,
    [browseMonthKey, query.page, query.pageSize, searchFilterKey, debouncedSearchTerm]
  )
  const prevBrowseIdentityRef = useRef<string | null>(null)
  const browseChangedRef = useRef(false)

  useEffect(() => {
    if (prevBrowseIdentityRef.current === browseIdentity) return
    prevBrowseIdentityRef.current = browseIdentity
    loadRequestIdRef.current += 1
    browseChangedRef.current = true
    setEntries([])
    setTotalCount(0)
  }, [browseIdentity])

  const loadEntries = useCallback(
    async (options: LoadDiaryEntriesOptions = {}) => {
      if (!diaryService) {
        setLoading(false)
        return
      }

      const browseChanged = browseChangedRef.current
      browseChangedRef.current = false
      const hasCachedRows = entriesRef.current.length > 0
      const silent = shouldDiaryListLoadSilently(hasCachedRows, browseChanged, options.silent)
      const requestId = ++loadRequestIdRef.current
      if (__DEV__) {
        console.log('[useDiaryData] loadEntries:start', {
          requestId,
          silent,
          browseChanged,
          hasCachedRows,
          cachedCount: entriesRef.current.length,
          isScreenFocused,
          browseIdentity
        })
      }
      if (!silent) {
        setLoading(true)
      }

      try {
        const currentQuery: DiaryPageQuery = {
          ...queryRef.current,
          searchQuery: debouncedSearchTermRef.current
        }
        const filter = buildListFilter(currentQuery)
        const countOpts = buildCountFilter(currentQuery)
        const term = currentQuery.searchQuery.trim()
        const searchFilter = buildSearchFilter(currentQuery)
        const pageOffset = (currentQuery.page - 1) * currentQuery.pageSize
        const pageLimit = currentQuery.pageSize

        if (term) {
          const { items, hasMore } = await diaryService.searchPage(term, {
            ...searchFilter,
            limit: pageLimit,
            offset: pageOffset
          })
          if (requestId !== loadRequestIdRef.current || !readyRef.current) return

          const mapped = items.map((item) => ({
            id: item.id,
            date: item.date,
            tags: item.tags ?? [],
            preview: item.preview ?? '',
            weather: item.weather,
            mood: item.mood,
            location: item.location,
            isFavorite: item.isFavorite,
            tagColors: item.tagColors,
            createdAt: item.updatedAt,
            updatedAt: item.updatedAt,
            content: ''
          }))
          if (!diaryListEntriesUnchanged(entriesRef.current, mapped)) {
            setEntries(mapped)
          } else if (__DEV__) {
            console.log('[useDiaryData] loadEntries:skip-setEntries', {
              requestId,
              reason: 'search-unchanged',
              count: mapped.length
            })
          }
          setTotalCount(hasMore ? pageOffset + pageLimit + 1 : pageOffset + items.length)
        } else {
          const [rawItems, total] = await Promise.all([
            diaryService.listFiltered(filter),
            diaryService.countFiltered(countOpts)
          ])
          if (requestId !== loadRequestIdRef.current || !readyRef.current) return

          let items = rawItems || []
          if (currentQuery.selectedMonth) {
            const mismatched = items.filter(
              (item) => !matchesSelectedMonth(item.date, currentQuery.selectedMonth!)
            )
            if (mismatched.length > 0) {
              logger.warn(
                `[useDiaryData] listFiltered 返回 ${mismatched.length} 条与月份筛选不符的日记，已客户端过滤`
              )
              items = items.filter((item) =>
                matchesSelectedMonth(item.date, currentQuery.selectedMonth!)
              )
            }
          }

          const mapped = items.map((item) => ({
            id: item.id,
            date: item.date,
            content: item.preview ?? '',
            tags: item.tags ?? [],
            preview: item.preview ?? '',
            weather: item.weather,
            mood: item.mood,
            location: item.location,
            isFavorite: item.isFavorite,
            tagColors: item.tagColors,
            createdAt: item.updatedAt,
            updatedAt: item.updatedAt
          }))
          if (!diaryListEntriesUnchanged(entriesRef.current, mapped)) {
            setEntries(mapped)
          } else if (__DEV__) {
            console.log('[useDiaryData] loadEntries:skip-setEntries', {
              requestId,
              reason: 'list-unchanged',
              count: mapped.length
            })
          }
          setTotalCount(typeof total === 'number' ? total : items.length)
        }
      } catch (err) {
        if (requestId !== loadRequestIdRef.current) return
        logger.error('获取日记列表失败', err instanceof Error ? err : String(err))
        toast.showError(t('diary.load_list_failed', '加载日记列表失败'))
        if (browseChanged || !hasCachedRows) {
          setEntries([])
          setTotalCount(0)
        }
      } finally {
        if (requestId === loadRequestIdRef.current) {
          lastLoadedCacheVersionRef.current = diaryListCacheVersion
          setLoading(false)
          if (__DEV__) {
            console.log('[useDiaryData] loadEntries:done', {
              requestId,
              entryCount: entriesRef.current.length
            })
          }
        }
      }
    },
    [diaryService, t, toast, isScreenFocused, browseIdentity]
  )

  const prevScreenFocusedRef = useRef(isScreenFocused)
  const lastLoadedCacheVersionRef = useRef(diaryListCacheVersion)

  useEffect(() => {
    const wasFocused = prevScreenFocusedRef.current
    const gainingFocus = isScreenFocused && !wasFocused
    prevScreenFocusedRef.current = isScreenFocused

    if (!ready || !diaryService) {
      if (__DEV__) {
        console.log('[useDiaryData] effect:reset', { ready, hasService: !!diaryService })
      }
      loadRequestIdRef.current += 1
      setEntries([])
      setTotalCount(0)
      setLoading(false)
      lastLoadedCacheVersionRef.current = diaryListCacheVersion
      return
    }

    if (!isScreenFocused) {
      if (__DEV__) {
        console.log('[useDiaryData] effect:defer-unfocused', {
          cachedCount: entriesRef.current.length,
          diaryListCacheVersion,
          lastLoadedCacheVersion: lastLoadedCacheVersionRef.current
        })
      }
      return
    }

    const cacheStale = diaryListCacheVersion !== lastLoadedCacheVersionRef.current
    const browseChanged = browseChangedRef.current
    const needsInitialLoad = entriesRef.current.length === 0

    if (gainingFocus && !cacheStale && !browseChanged && !needsInitialLoad) {
      if (__DEV__) {
        console.log('[useDiaryData] effect:skip-regain-focus', {
          cachedCount: entriesRef.current.length
        })
      }
      return
    }

    if (__DEV__) {
      console.log('[useDiaryData] effect:load', {
        isScreenFocused,
        gainingFocus,
        cacheStale,
        browseChanged,
        needsInitialLoad,
        cachedCount: entriesRef.current.length,
        diaryListCacheVersion,
        browseIdentity
      })
    }

    void loadEntries({
      silent: shouldDiaryListLoadSilently(entriesRef.current.length > 0, browseChanged)
    })
  }, [
    ready,
    diaryService,
    loadEntries,
    browseIdentity,
    vaultRevision,
    ecosystemResyncEpoch,
    diaryListCacheVersion,
    isScreenFocused,
    debouncedSearchTerm ? 0 : listFilter,
    debouncedSearchTerm ? 0 : countFilter
  ])

  const isSearchPending = rawSearchTerm !== debouncedSearchTerm

  return { entries, totalCount, loading, searchPending: isSearchPending, loadEntries }
}
