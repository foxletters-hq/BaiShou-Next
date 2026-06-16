import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { logger, weatherMatchesFilter, formatSemanticChunkSnippet } from '@baishou/shared'
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
  /** 语义搜索相似度 0–1 */
  matchSimilarity?: number
}

export interface UseDiaryDataOptions {
  ready?: boolean
  vaultRevision?: number
}

const SEARCH_DEBOUNCE_MS = 500
/** 语义搜索一次拉取的分片上限，去重后用于分页 */
const SEMANTIC_CHUNK_FETCH_CAP = 150
/** 日记语义搜索最低相似度（低于此不展示） */
const SEMANTIC_MIN_SIMILARITY = 0.3

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
function buildSearchFilter(query: DiaryPageQuery): Omit<DiaryListFilter, 'limit' | 'offset' | 'orderBy'> {
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

type SemanticDiaryHit = {
  diaryId: number
  snippet: string
  similarity: number
}

function collectSemanticDiaryHits(entries: Array<Record<string, unknown>>): SemanticDiaryHit[] {
  const bestByDiary = new Map<number, SemanticDiaryHit>()

  for (const row of entries) {
    if (row.sourceType !== 'diary' || row.sourceId == null) continue
    const diaryId = Number(row.sourceId)
    if (!Number.isFinite(diaryId)) continue

    const similarity = typeof row.similarity === 'number' ? row.similarity : 0
    if (similarity < SEMANTIC_MIN_SIMILARITY) continue
    const snippet = formatSemanticChunkSnippet(String(row.text ?? ''))
    const existing = bestByDiary.get(diaryId)
    if (!existing || similarity > existing.similarity) {
      bestByDiary.set(diaryId, { diaryId, snippet, similarity })
    }
  }

  const ordered: SemanticDiaryHit[] = []
  const seen = new Set<number>()
  for (const row of entries) {
    if (row.sourceType !== 'diary' || row.sourceId == null) continue
    const diaryId = Number(row.sourceId)
    if (!Number.isFinite(diaryId) || seen.has(diaryId)) continue
    const hit = bestByDiary.get(diaryId)
    if (!hit || hit.similarity < SEMANTIC_MIN_SIMILARITY) continue
    seen.add(diaryId)
    ordered.push(hit)
  }

  return ordered
}

function searchFilterCacheKey(
  filter: Omit<DiaryListFilter, 'limit' | 'offset' | 'orderBy'>
): string {
  return `${filter.favorite ? 1 : 0}:${(filter.weathers ?? []).join(',')}`
}

type SemanticSearchCache = {
  term: string
  filterKey: string
  hits: SemanticDiaryHit[]
  truncated: boolean
}

function mapMetaToListEntry(
  meta: Awaited<ReturnType<DiaryService['findMetaByIds']>>[number],
  match?: Pick<SemanticDiaryHit, 'snippet' | 'similarity'>
): DiaryListEntryData {
  return {
    id: meta.id,
    date: meta.date,
    content: '',
    tags: meta.tags ?? [],
    preview: match?.snippet || meta.preview || '',
    weather: meta.weather,
    mood: meta.mood,
    location: meta.location,
    isFavorite: meta.isFavorite,
    createdAt: meta.updatedAt,
    updatedAt: meta.updatedAt,
    matchSimilarity: match?.similarity
  }
}

function hasActiveSearchFilter(
  filter: Omit<DiaryListFilter, 'limit' | 'offset' | 'orderBy'>
): boolean {
  return Boolean(filter.favorite || (filter.weathers && filter.weathers.length > 0))
}

export function useDiaryData(
  diaryService: DiaryService | undefined,
  query: DiaryPageQuery,
  ragService?: MobileRagService,
  options: UseDiaryDataOptions = {}
) {
  const { ready = true, vaultRevision = 0 } = options
  const [entries, setEntries] = useState<DiaryListEntryData[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const loadRequestIdRef = useRef(0)
  const semanticCacheRef = useRef<SemanticSearchCache | null>(null)

  const rawSearchTerm = query.searchQuery.trim()
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(rawSearchTerm)

  useEffect(() => {
    if (!rawSearchTerm) {
      setDebouncedSearchTerm('')
      semanticCacheRef.current = null
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
      const mode = effectiveQuery.searchMode
      const searchFilter = buildSearchFilter(effectiveQuery)
      const pageOffset = (effectiveQuery.page - 1) * effectiveQuery.pageSize
      const pageLimit = effectiveQuery.pageSize

      const applyTextSearch = async () => {
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
        setTotalCount(
          hasMore ? pageOffset + pageLimit + 1 : pageOffset + items.length
        )
      }

      const buildSemanticPage = async (hits: SemanticDiaryHit[], truncated: boolean) => {
        const needsFilter = hasActiveSearchFilter(searchFilter)

        if (!needsFilter) {
          const pageHits = hits.slice(pageOffset, pageOffset + pageLimit)
          const metas = await diaryService.findMetaByIds(pageHits.map((h) => h.diaryId))
          if (requestId !== loadRequestIdRef.current) return

          const metaMap = new Map(metas.map((m) => [m.id, m] as const))
          const pageEntries = pageHits
            .map((hit) => {
              const meta = metaMap.get(hit.diaryId)
              if (!meta) {
                logger.warn('[DiarySearch] 语义命中但影子索引缺失', { diaryId: hit.diaryId })
                return null
              }
              return mapMetaToListEntry(meta, hit)
            })
            .filter((item): item is DiaryListEntryData => item != null)

          setEntries(pageEntries)
          setTotalCount(
            truncated && pageOffset + pageLimit >= hits.length
              ? hits.length + 1
              : hits.length
          )
          return
        }

        const metas = await diaryService.findMetaByIds(hits.map((h) => h.diaryId))
        if (requestId !== loadRequestIdRef.current) return

        const metaMap = new Map(metas.map((m) => [m.id, m] as const))
        const matched = hits
          .map((hit) => {
            const meta = metaMap.get(hit.diaryId)
            if (!meta) {
              logger.warn('[DiarySearch] 语义命中但影子索引缺失', { diaryId: hit.diaryId })
              return null
            }
            if (!matchesDiaryFilter(meta, searchFilter)) return null
            return mapMetaToListEntry(meta, hit)
          })
          .filter((item): item is DiaryListEntryData => item != null)

        setEntries(matched.slice(pageOffset, pageOffset + pageLimit))
        setTotalCount(
          truncated && pageOffset + pageLimit >= matched.length
            ? matched.length + 1
            : matched.length
        )
      }

      if (term && mode === 'semantic' && ragService) {
        const cacheKey = searchFilterCacheKey(searchFilter)
        const cache = semanticCacheRef.current
        const cacheValid =
          cache != null && cache.term === term && cache.filterKey === cacheKey

        if (!cacheValid) {
          try {
            const res = await ragService.queryEntries({
              keyword: term,
              mode: 'semantic',
              limit: SEMANTIC_CHUNK_FETCH_CAP,
              offset: 0,
              withTotal: true,
              minSimilarity: SEMANTIC_MIN_SIMILARITY,
              sourceType: 'diary'
            })
            if (requestId !== loadRequestIdRef.current) return

            const hits = collectSemanticDiaryHits(res.entries as Array<Record<string, unknown>>)
            if (hits.length === 0) {
              semanticCacheRef.current = null
              logger.warn('[DiarySearch] 语义搜索无结果，降级为文本搜索')
              await applyTextSearch()
              return
            }

            semanticCacheRef.current = {
              term,
              filterKey: cacheKey,
              hits,
              truncated: res.entries.length >= SEMANTIC_CHUNK_FETCH_CAP
            }
          } catch (err) {
            if (requestId !== loadRequestIdRef.current) return
            semanticCacheRef.current = null
            logger.warn(
              '[DiarySearch] 语义搜索失败，降级为文本搜索',
              err instanceof Error ? err : String(err)
            )
            await applyTextSearch()
            return
          }
        }

        await buildSemanticPage(semanticCacheRef.current!.hits, semanticCacheRef.current!.truncated)
      } else if (term) {
        semanticCacheRef.current = null
        await applyTextSearch()
      } else {
        semanticCacheRef.current = null
        const [items, total] = await Promise.all([
          diaryService.listFiltered(filter),
          diaryService.countFiltered(countOpts)
        ])
        if (requestId !== loadRequestIdRef.current) return
        setEntries(
          (items || []).map((item) => ({
            id: item.id,
            date: item.date,
            content: item.content ?? '',
            tags: item.tags ?? [],
            preview: item.preview ?? item.content?.substring(0, 500) ?? '',
            weather: item.weather,
            mood: item.mood,
            location: item.location,
            isFavorite: item.isFavorite,
            createdAt: item.createdAt,
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
  }, [diaryService, ragService, effectiveQuery])

  useEffect(() => {
    if (!ready || !diaryService) return
    void loadEntries()
  }, [
    ready,
    diaryService,
    loadEntries,
    debouncedSearchTerm,
    searchMode,
    query.page,
    query.pageSize,
    vaultRevision,
    searchFilterKey,
    debouncedSearchTerm ? 0 : browseMonthKey,
    debouncedSearchTerm ? 0 : listFilter,
    debouncedSearchTerm ? 0 : countFilter
  ])

  const isSearchPending = rawSearchTerm !== debouncedSearchTerm

  return { entries, totalCount, loading: loading || isSearchPending, loadEntries }
}
