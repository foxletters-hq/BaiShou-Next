import { ShadowIndexRepository } from '@baishou/database'
import {
  Diary,
  DiaryListFilter,
  DiaryMeta,
  moodMatchesFilter,
  normalizeDiaryPreviewMarkdown,
  normalizeDiaryTagColorRegistry,
  parseDateStr,
  resolveDiaryTagsFromSources,
  resolveMoodId,
  resolveWeatherId,
  weatherMatchesFilter
} from '@baishou/shared'

export function buildDiaryFromShadowRow(
  shadow: NonNullable<Awaited<ReturnType<ShadowIndexRepository['findById']>>>,
  date: Date
): Diary {
  const parsedTags = resolveDiaryTagsFromSources(shadow.tags ?? '', shadow.rawContent ?? '')

  return {
    id: shadow.id,
    date,
    content: shadow.rawContent ?? '',
    tags: parsedTags.length > 0 ? parsedTags.join(',') : undefined,
    tagColors:
      Object.keys(normalizeDiaryTagColorRegistry(shadow.tagColors)).length > 0
        ? normalizeDiaryTagColorRegistry(shadow.tagColors)
        : undefined,
    updatedAt: shadow.updatedAt ? new Date(shadow.updatedAt) : undefined,
    weather: shadow.weather ?? undefined,
    mood: shadow.mood ?? undefined,
    location: shadow.location ?? undefined,
    locationDetail: shadow.locationDetail ?? undefined,
    isFavorite: shadow.isFavorite,
    mediaPaths: []
  }
}

export function mapShadowRowToMeta(
  s: {
    id: number
    date: string
    updatedAt: string
    weather: string | null
    mood: string | null
    location: string | null
    isFavorite: boolean
    hasMedia: boolean
    rawContent?: string | null
    tags?: string | null
    tagsStr?: string | null
    tagColors?: string | null
  },
  previewOverride?: string
): DiaryMeta {
  const tagColors = normalizeDiaryTagColorRegistry(s.tagColors)
  const rawContent = s.rawContent ?? ''
  const parsedTags = resolveDiaryTagsFromSources(s.tags ?? s.tagsStr ?? '', rawContent)
  return {
    id: s.id,
    date: parseDateStr(s.date.split('T')[0]!),
    preview: normalizeDiaryPreviewMarkdown(
      previewOverride || (rawContent ? rawContent.substring(0, 500) : '')
    ),
    tags: parsedTags,
    tagColors: Object.keys(tagColors).length > 0 ? tagColors : undefined,
    updatedAt: s.updatedAt ? new Date(s.updatedAt) : undefined,
    weather: resolveWeatherId(s.weather) ?? undefined,
    mood: resolveMoodId(s.mood) ?? undefined,
    location: s.location || undefined,
    isFavorite: s.isFavorite || false,
    hasMedia: s.hasMedia || false
  }
}

export function hasPostSearchFilter(
  filter: Omit<DiaryListFilter, 'limit' | 'offset' | 'orderBy'>
): boolean {
  return Boolean(
    filter.favorite ||
    (filter.weathers && filter.weathers.length > 0) ||
    (filter.moods && filter.moods.length > 0) ||
    (filter.year != null && filter.month != null)
  )
}

export function matchesListFilter(
  meta: DiaryMeta,
  filter: Omit<DiaryListFilter, 'limit' | 'offset' | 'orderBy'>
): boolean {
  if (filter.year != null && filter.month != null) {
    if (meta.date.getFullYear() !== filter.year || meta.date.getMonth() + 1 !== filter.month) {
      return false
    }
  }
  if (filter.favorite && !meta.isFavorite) return false
  if (filter.weathers && filter.weathers.length > 0) {
    if (!weatherMatchesFilter(meta.weather, filter.weathers)) return false
  }
  if (filter.moods && filter.moods.length > 0) {
    if (!moodMatchesFilter(meta.mood, filter.moods)) return false
  }
  return true
}

export async function mapFtsHitsToFilteredMetas(
  shadowRepo: ShadowIndexRepository,
  hits: Awaited<ReturnType<ShadowIndexRepository['searchFTS']>>,
  filterOpts: Omit<DiaryListFilter, 'limit' | 'offset' | 'orderBy'>
): Promise<DiaryMeta[]> {
  if (hits.length === 0) return []

  const missingIds = hits.filter((h) => !h.indexRow).map((h) => h.rowid)
  const batchRows = missingIds.length > 0 ? await shadowRepo.findByIds(missingIds) : []
  const rowMap = new Map(batchRows.map((r) => [r.id, r]))
  for (const hit of hits) {
    if (hit.indexRow) rowMap.set(hit.rowid, hit.indexRow)
  }

  return hits
    .map((hit) => {
      const row = hit.indexRow ?? rowMap.get(hit.rowid)
      if (!row) return null
      const meta = mapShadowRowToMeta(row, hit.contentSnippet)
      return matchesListFilter(meta, filterOpts) ? meta : null
    })
    .filter((item): item is DiaryMeta => item !== null)
}
