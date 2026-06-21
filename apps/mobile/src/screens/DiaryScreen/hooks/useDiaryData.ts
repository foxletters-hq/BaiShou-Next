import { useState, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { logger } from '@baishou/shared'
import type { DiaryListFilter } from '@baishou/shared'
import type { DiaryService } from '@baishou/core-mobile'
import { getDiaryListCacheVersion, subscribeDiaryListCache } from '@baishou/shared/cache'

export interface DiaryPageQuery {
  selectedMonth: Date | null
  searchQuery: string
  filterWeathers: string[]
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
  createdAt?: Date | string
  updatedAt?: Date | string
}

export interface UseDiaryDataOptions {
  ready?: boolean
  vaultRevision?: number
  ecosystemResyncEpoch?: number
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

  return filter
}

/** 搜索模式：跨月全文检索，仅保留天气/收藏筛选 */
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

  return filter
}

function buildCountFilter(query: DiaryPageQuery): Omit<DiaryListFilter, 'limit' | 'offset'> {
  const { limit: _l, offset: _o, orderBy: _ob, ...rest } = buildListFilter(query)
  return rest
}

function searchFilterCacheKey(
  filter: Omit<DiaryListFilter, 'limit' | 'offset' | 'orderBy'>
): string {
  return `${filter.favorite ? 1 : 0}:${(filter.weathers ?? []).join(',')}`
}

export function useDiaryData(
  diaryService: DiaryService | undefined,
  query: DiaryPageQuery,
  options: UseDiaryDataOptions = {}
) {
  const { ready = true, vaultRevision = 0, ecosystemResyncEpoch = 0 } = options
  const [entries, setEntries] = useState<DiaryListEntryData[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const loadRequestIdRef = useRef(0)
  const diaryListCacheVersion = useSyncExternalStore(
    subscribeDiaryListCache,
    getDiaryListCacheVersion
  )

  const rawSearchTerm = query.searchQuery.trim()
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(rawSearchTerm)

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
    [effectiveQuery.filterFavorite, effectiveQuery.filterWeathers]
  )

  const loadEntries = useCallback(async () => {
    if (!diaryService) {
      setLoading(false)
      return
    }

    const requestId = ++loadRequestIdRef.current
    setLoading(true)

    try {
      const filter = buildListFilter(effectiveQuery)
      const countOpts = buildCountFilter(effectiveQuery)
      const term = effectiveQuery.searchQuery.trim()
      const searchFilter = buildSearchFilter(effectiveQuery)
      const pageOffset = (effectiveQuery.page - 1) * effectiveQuery.pageSize
      const pageLimit = effectiveQuery.pageSize

      if (term) {
        const { items, hasMore } = await diaryService.searchPage(term, {
          ...searchFilter,
          limit: pageLimit,
          offset: pageOffset
        })
        if (requestId !== loadRequestIdRef.current) return

        setEntries(
          items.map((item) => ({
            id: item.id,
            date: item.date,
            tags: item.tags ?? [],
            preview: item.preview ?? '',
            weather: item.weather,
            mood: item.mood,
            location: item.location,
            isFavorite: item.isFavorite,
            createdAt: item.updatedAt,
            updatedAt: item.updatedAt,
            content: ''
          }))
        )
        setTotalCount(hasMore ? pageOffset + pageLimit + 1 : pageOffset + items.length)
      } else {
        const [items, total] = await Promise.all([
          diaryService.listFiltered(filter),
          diaryService.countFiltered(countOpts)
        ])
        if (requestId !== loadRequestIdRef.current) return
        setEntries(
          (items || []).map((item) => ({
            id: item.id,
            date: item.date,
            content: item.preview ?? '',
            tags: item.tags ?? [],
            preview: item.preview ?? '',
            weather: item.weather,
            mood: item.mood,
            location: item.location,
            isFavorite: item.isFavorite,
            createdAt: item.updatedAt,
            updatedAt: item.updatedAt
          }))
        )
        setTotalCount(typeof total === 'number' ? total : items?.length || 0)
      }
    } catch (err) {
      if (requestId !== loadRequestIdRef.current) return
      logger.error('获取日记列表失败', err instanceof Error ? err : String(err))
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false)
      }
    }
  }, [diaryService, effectiveQuery])

  useEffect(() => {
    if (!ready || !diaryService) {
      setEntries([])
      setTotalCount(0)
      setLoading(false)
      return
    }
    void loadEntries()
  }, [
    ready,
    diaryService,
    loadEntries,
    debouncedSearchTerm,
    query.page,
    query.pageSize,
    vaultRevision,
    ecosystemResyncEpoch,
    diaryListCacheVersion,
    searchFilterKey,
    debouncedSearchTerm ? 0 : browseMonthKey,
    debouncedSearchTerm ? 0 : listFilter,
    debouncedSearchTerm ? 0 : countFilter
  ])

  const isSearchPending = rawSearchTerm !== debouncedSearchTerm

  return { entries, totalCount, loading: loading || isSearchPending, loadEntries }
}
