import { formatLocalDate, safeParseDate, type Summary, type SummaryType } from '@baishou/shared'
import type { CachedSummaryDetail } from './summaryDetailCache'

/** 总结区间日期统一存 YYYY-MM-DD（日历日），避免 toISOString 时区偏移 */
export function summaryDateToStorageKey(value: Date | string | undefined | null): string {
  if (value instanceof Date) return formatLocalDate(value)
  if (value == null || value === '') return ''
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const parsed = new Date(text)
  if (!isNaN(parsed.getTime())) return formatLocalDate(parsed)
  return text
}

export function isSameSummaryDetail(a: CachedSummaryDetail, b: CachedSummaryDetail): boolean {
  return (
    a.content === b.content &&
    a.generatedAt === b.generatedAt &&
    (a.sourceIds ?? null) === (b.sourceIds ?? null)
  )
}

export function mapSummaryToDetail(summary: Summary): CachedSummaryDetail {
  return {
    id: summary.id,
    type: summary.type,
    startDate: summaryDateToStorageKey(summary.startDate),
    endDate: summaryDateToStorageKey(summary.endDate),
    content: summary.content,
    sourceIds: summary.sourceIds,
    generatedAt:
      summary.generatedAt instanceof Date
        ? summary.generatedAt.toISOString()
        : summary.generatedAt != null
          ? String(summary.generatedAt)
          : undefined
  }
}

export function parseSummaryBoundaryDate(value: string): Date {
  return safeParseDate(summaryDateToStorageKey(value))
}

export async function loadSummaryDetailById(
  summaryId: string,
  services: {
    summaryManager: {
      listForGallery: () => Promise<Summary[]>
      readDetail: (type: SummaryType, start: Date, end: Date) => Promise<Summary | null>
    }
  },
  seed?: CachedSummaryDetail | null
): Promise<CachedSummaryDetail | null> {
  let hint = seed ?? null
  if (!hint) {
    const list = await services.summaryManager.listForGallery()
    const found = list.find((item) => String(item.id) === summaryId)
    if (!found) return null
    hint = mapSummaryToDetail(found)
  }

  const startDate = parseSummaryBoundaryDate(hint.startDate)
  const endDate = parseSummaryBoundaryDate(hint.endDate)
  const detail = await services.summaryManager.readDetail(
    hint.type as SummaryType,
    startDate,
    endDate
  )
  if (!detail) return hint
  return mapSummaryToDetail(detail)
}

export async function refreshSummaryDetail(
  summary: CachedSummaryDetail,
  services: {
    summaryManager: {
      readDetail: (type: SummaryType, start: Date, end: Date) => Promise<Summary | null>
    }
  }
): Promise<CachedSummaryDetail | null> {
  const startDate = parseSummaryBoundaryDate(summary.startDate)
  const endDate = parseSummaryBoundaryDate(summary.endDate)
  const detail = await services.summaryManager.readDetail(
    summary.type as SummaryType,
    startDate,
    endDate
  )
  if (!detail) return summary
  return mapSummaryToDetail(detail)
}
