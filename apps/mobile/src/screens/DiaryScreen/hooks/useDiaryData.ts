import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { logger, weatherMatchesFilter } from '@baishou/shared'
import type { DiaryListFilter } from '@baishou/shared'
import type { DiaryService } from '@baishou/core-mobile'
import type { MobileRagService } from '../../../services/mobile-rag.service'

export interface DiaryPageQuery {
  selectedMonth: Date | null
  searchQuery: string
  searchMode: 'semantic' | 'text'
  filterWeathers: string[]
  filterFavorite: boolean
  page: number
  pageSize: number
}

export interface UseDiaryDataOptions {
  ready?: boolean
  vaultRevision?: number
}

const SEARCH_DEBOUNCE_MS = 350

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

function buildCountFilter(query: DiaryPageQuery): Omit<DiaryListFilter, 'limit' | 'offset'> {
  const { limit: _l, offset: _o, orderBy: _ob, ...rest } = buildListFilter(query)
  return rest
}

function matchesDiaryFilter(
  entry: {
    date?: Date | string
    isFavorite?: boolean
    weather?: string | null
  },
  filter: Omit<DiaryListFilter, 'limit' | 'offset' | 'orderBy'>
): boolean {
  const date = entry.date ? new Date(entry.date) : null
  if (filter.year != null && filter.month != null && date && !isNaN(date.getTime())) {
    if (date.getFullYear() !== filter.year || date.getMonth() + 1 !== filter.month) {
      return false
    }
  }
  if (filter.favorite && !entry.isFavorite) return false
  if (filter.weathers && filter.weathers.length > 0) {
    if (!weatherMatchesFilter(entry.weather ?? undefined, filter.weathers)) return false
  }
  return true
}

function mapDiaryToListEntry(diary: NonNullable<Awaited<ReturnType<DiaryService['findById']>>>) {
  return {
    id: diary.id,
    date: diary.date,
    content: diary.content,
    tags: diary.tags ?? [],
    preview: diary.content?.substring(0, 500) ?? '',
    weather: diary.weather,
    mood: diary.mood,
    location: diary.location,
    isFavorite: diary.isFavorite,
    createdAt: diary.createdAt,
    updatedAt: diary.updatedAt
  }
}

export function useDiaryData(
  diaryService: DiaryService | undefined,
  query: DiaryPageQuery,
  ragService?: MobileRagService,
  options: UseDiaryDataOptions = {}
) {
  const { ready = true, vaultRevision = 0 } = options
  const [entries, setEntries] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const loadRequestIdRef = useRef(0)

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
  const searchMode = effectiveQuery.searchMode

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
      const mode = effectiveQuery.searchMode

      if (term && mode === 'semantic' && ragService) {
        const res = await ragService.queryEntries({
          keyword: term,
          mode: 'semantic',
          limit: 50,
          offset: 0,
          withTotal: true
        })
        if (requestId !== loadRequestIdRef.current) return

        const orderedIds: number[] = []
        const seen = new Set<number>()
        for (const row of res.entries) {
          if (row.sourceType !== 'diary' || row.sourceId == null) continue
          const id = Number(row.sourceId)
          if (!Number.isFinite(id) || seen.has(id)) continue
          seen.add(id)
          orderedIds.push(id)
        }

        const diaries = (
          await Promise.all(orderedIds.map((id) => diaryService.findById(id)))
        ).filter((d): d is NonNullable<typeof d> => d != null)
        if (requestId !== loadRequestIdRef.current) return

        const { limit: _l, offset: _o, orderBy: _ob, ...filterRest } = filter
        const filtered = diaries
          .filter((d) => matchesDiaryFilter(d, filterRest))
          .map(mapDiaryToListEntry)

        const offset = filter.offset ?? 0
        const limit = filter.limit ?? filtered.length
        const pageItems = filtered.slice(offset, offset + limit)

        setEntries(pageItems)
        setTotalCount(filtered.length)
      } else if (term) {
        const pageLimit = filter.limit ?? 50
        const pageOffset = filter.offset ?? 0
        const items = await diaryService.search(term, {
          ...filter,
          limit: pageLimit + 1,
          offset: pageOffset
        })
        if (requestId !== loadRequestIdRef.current) return
        const hasMore = (items?.length ?? 0) > pageLimit
        const pageItems = hasMore ? items!.slice(0, pageLimit) : items || []
        setEntries(pageItems)
        setTotalCount(hasMore ? pageOffset + pageLimit + 1 : pageOffset + pageItems.length)
      } else {
        const [items, total] = await Promise.all([
          diaryService.listFiltered(filter),
          diaryService.countFiltered(countOpts)
        ])
        if (requestId !== loadRequestIdRef.current) return
        setEntries(items || [])
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
  }, [diaryService, ragService, effectiveQuery])

  useEffect(() => {
    if (!ready || !diaryService) return
    void loadEntries()
  }, [
    ready,
    diaryService,
    loadEntries,
    listFilter,
    countFilter,
    debouncedSearchTerm,
    searchMode,
    query.page,
    query.pageSize,
    vaultRevision
  ])

  const isSearchPending = rawSearchTerm !== debouncedSearchTerm

  return { entries, totalCount, loading: loading || isSearchPending, loadEntries }
}
