import { parseDateStr } from '@baishou/shared'

export interface VectorSearchDateRange {
  startMs?: number
  endMs?: number
}

export function resolveVectorSearchDateRange(
  startDate?: string,
  endDate?: string
): VectorSearchDateRange | { error: string } {
  let startMs: number | undefined
  let endMs: number | undefined

  if (startDate?.trim()) {
    try {
      startMs = parseDateStr(startDate.trim()).getTime()
    } catch {
      return { error: `无效的开始日期 "${startDate}"，请使用 YYYY-MM-DD 格式。` }
    }
  }

  if (endDate?.trim()) {
    try {
      const end = parseDateStr(endDate.trim())
      endMs = end.getTime() + 24 * 60 * 60 * 1000 - 1
    } catch {
      return { error: `无效的结束日期 "${endDate}"，请使用 YYYY-MM-DD 格式。` }
    }
  }

  if (startMs != null && endMs != null && startMs > endMs) {
    return { error: '开始日期不能晚于结束日期。' }
  }

  return { startMs, endMs }
}

export function formatVectorSearchDateRangeLabel(
  startDate?: string,
  endDate?: string
): string | null {
  const start = startDate?.trim()
  const end = endDate?.trim()
  if (!start && !end) return null
  if (start && end) return `${start} ~ ${end}`
  if (start) return `${start} 起`
  return `至 ${end}`
}
