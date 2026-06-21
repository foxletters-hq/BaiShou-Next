import { useState, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { logger, normalizeDiaryTags } from '@baishou/shared'
import type { DiaryListFilter } from '@baishou/shared'
import { getDiaryListCacheVersion, subscribeDiaryListCache } from '@baishou/shared/cache'
import {
  getDesktopVaultScopeKey,
  subscribeDesktopVaultScope
} from '../../../cache/desktop-vault-scope'

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

function patchEntriesWithSaved(prev: any[], saved: any): any[] {
  if (!saved?.id) return prev
  const idx = prev.findIndex((e) => e.id === saved.id)
  if (idx >= 0) {
    const next = [...prev]
    next[idx] = {
      ...next[idx],
      ...saved,
      tags: normalizeDiaryTags(saved.tags ?? next[idx].tags)
    }
    return next
  }
  return prev
}

export function useDiaryData(query: DiaryPageQuery) {
  const [entries, setEntries] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const queryRef = useRef(query)
  queryRef.current = query
  const entriesRef = useRef<any[]>([])
  entriesRef.current = entries
  const diaryListCacheVersion = useSyncExternalStore(
    subscribeDiaryListCache,
    getDiaryListCacheVersion
  )
  const vaultScopeKey = useSyncExternalStore(subscribeDesktopVaultScope, getDesktopVaultScopeKey)

  useEffect(() => {
    setEntries([])
    setTotalCount(0)
  }, [vaultScopeKey])

  const listFilter = useMemo(() => buildListFilter(query), [query])
  const countFilter = useMemo(() => buildCountFilter(query), [query])
  const searchTerm = query.searchQuery.trim()
  const browseMonthKey = query.selectedMonth?.getTime() ?? 0
  const searchFilterKey = useMemo(
    () => `${query.filterFavorite ? 1 : 0}:${query.filterWeathers.join(',')}`,
    [query.filterFavorite, query.filterWeathers]
  )

  const loadEntries = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false
    const hasCachedRows = entriesRef.current.length > 0
    if (!silent || !hasCachedRows) {
      setLoading(true)
    }
    try {
      const api = (window as any).api
      const current = queryRef.current
      const filter = buildListFilter(current)
      const countOpts = buildCountFilter(current)
      const term = current.searchQuery.trim()

      if (api?.diary?.listFiltered) {
        if (term) {
          const searchFilter = buildSearchFilter(current)
          const pageOffset = (current.page - 1) * current.pageSize
          const pageLimit = current.pageSize
          const items = await api.diary.search(term, {
            ...searchFilter,
            limit: pageLimit,
            offset: pageOffset
          })
          setEntries(items || [])
          const loaded = items?.length || 0
          setTotalCount(loaded < pageLimit ? pageOffset + loaded : pageOffset + loaded + 1)
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
  }, [
    loadEntries,
    searchTerm,
    query.page,
    query.pageSize,
    searchTerm ? searchFilterKey : browseMonthKey,
    searchTerm ? 0 : listFilter,
    searchTerm ? 0 : countFilter,
    diaryListCacheVersion,
    vaultScopeKey
  ])

  useEffect(() => {
    const api = (window as any).api
    let unsubscribe: (() => void) | undefined

    if (api?.diary?.onSyncEvent) {
      unsubscribe = api.diary.onSyncEvent((event: { type?: string; entry?: any }) => {
        const hasCachedRows = entriesRef.current.length > 0
        if (event?.type === 'saved' && event.entry) {
          logger.info('[useDiaryData] 收到 diary 保存事件，静默刷新列表')
          setEntries((prev) => patchEntriesWithSaved(prev, event.entry))
          void loadEntries({ silent: true })
          return
        }
        if (event?.type === 'indexing-progress') {
          void loadEntries({ silent: hasCachedRows })
          return
        }
        logger.info('[useDiaryData] 收到 diary:sync-event，刷新当前页')
        void loadEntries({ silent: hasCachedRows })
      })
    }

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [loadEntries])

  return { entries, totalCount, loading, loadEntries }
}
