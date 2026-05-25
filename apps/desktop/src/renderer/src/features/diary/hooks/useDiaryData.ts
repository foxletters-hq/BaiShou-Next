import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { logger } from '@baishou/shared'
import type { DiaryListFilter } from '@baishou/shared'

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

export function useDiaryData(query: DiaryPageQuery) {
  const [entries, setEntries] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const queryRef = useRef(query)
  queryRef.current = query

  const listFilter = useMemo(() => buildListFilter(query), [query])
  const countFilter = useMemo(() => buildCountFilter(query), [query])
  const searchTerm = query.searchQuery.trim()

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      const api = (window as any).api
      const current = queryRef.current
      const filter = buildListFilter(current)
      const countOpts = buildCountFilter(current)
      const term = current.searchQuery.trim()

      if (api?.diary?.listFiltered) {
        if (term) {
          const items = await api.diary.search(term, filter)
          setEntries(items || [])
          const loaded = items?.length || 0
          setTotalCount(
            loaded < (filter.limit ?? 0)
              ? (filter.offset ?? 0) + loaded
              : (filter.offset ?? 0) + loaded + 1
          )
        } else {
          const [items, total] = await Promise.all([
            api.diary.listFiltered(filter),
            api.diary.countFiltered(countOpts)
          ])
          setEntries(items || [])
          setTotalCount(typeof total === 'number' ? total : items?.length || 0)
        }
      } else if (api?.diary?.listAll) {
        const result = await api.diary.listAll({ limit: filter.limit, offset: filter.offset })
        setEntries(result || [])
        setTotalCount(result?.length || 0)
      }
    } catch (err) {
      logger.error('Failed to load diary entries:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEntries()
  }, [loadEntries, listFilter, countFilter, searchTerm, query.page, query.pageSize])

  useEffect(() => {
    const api = (window as any).api
    let unsubscribe: (() => void) | undefined

    if (api?.diary?.onSyncEvent) {
      unsubscribe = api.diary.onSyncEvent(() => {
        logger.info('[useDiaryData] 收到 diary:sync-event，刷新当前页')
        loadEntries()
      })
    }

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [loadEntries])

  return { entries, totalCount, loading, loadEntries }
}
