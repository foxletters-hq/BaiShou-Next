import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { logger } from '@baishou/shared'
import type { DiaryListFilter } from '@baishou/shared'
import type { DiaryService } from '@baishou/core/mobile'

export interface DiaryPageQuery {
  selectedMonth: Date | null
  searchQuery: string
  filterWeathers: string[]
  filterFavorite: boolean
  page: number
  pageSize: number
}

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

export function useDiaryData(diaryService: DiaryService | undefined, query: DiaryPageQuery) {
  const [entries, setEntries] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const queryRef = useRef(query)
  queryRef.current = query

  const listFilter = useMemo(() => buildListFilter(query), [query])
  const countFilter = useMemo(() => buildCountFilter(query), [query])
  const searchTerm = query.searchQuery.trim()

  const loadEntries = useCallback(async () => {
    if (!diaryService) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const current = queryRef.current
      const filter = buildListFilter(current)
      const countOpts = buildCountFilter(current)
      const term = current.searchQuery.trim()

      if (term) {
        const items = await diaryService.search(term, filter)
        setEntries(items || [])
        const loaded = items?.length || 0
        setTotalCount(
          loaded < (filter.limit ?? 0)
            ? (filter.offset ?? 0) + loaded
            : (filter.offset ?? 0) + loaded + 1
        )
      } else {
        const [items, total] = await Promise.all([
          diaryService.listFiltered(filter),
          diaryService.countFiltered(countOpts)
        ])
        setEntries(items || [])
        setTotalCount(typeof total === 'number' ? total : items?.length || 0)
      }
    } catch (err) {
      logger.error('获取日记列表失败', err instanceof Error ? err : String(err))
    } finally {
      setLoading(false)
    }
  }, [diaryService])

  useEffect(() => {
    loadEntries()
  }, [loadEntries, listFilter, countFilter, searchTerm, query.page, query.pageSize])

  return { entries, totalCount, loading, loadEntries }
}
