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
  ragService?: MobileRagService
) {
  const [entries, setEntries] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const queryRef = useRef(query)
  queryRef.current = query

  const listFilter = useMemo(() => buildListFilter(query), [query])
  const countFilter = useMemo(() => buildCountFilter(query), [query])
  const searchTerm = query.searchQuery.trim()
  const searchMode = query.searchMode

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
      const mode = current.searchMode

      if (term && mode === 'semantic' && ragService) {
        const res = await ragService.queryEntries({
          keyword: term,
          mode: 'semantic',
          limit: 50,
          offset: 0,
          withTotal: true
        })

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
  }, [diaryService, ragService])

  useEffect(() => {
    loadEntries()
  }, [loadEntries, listFilter, countFilter, searchTerm, searchMode, query.page, query.pageSize])

  return { entries, totalCount, loading, loadEntries }
}
