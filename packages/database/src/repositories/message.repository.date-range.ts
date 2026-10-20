import { isRealLocalCalendarDate } from '@baishou/shared'

export const DATE_RANGE_LIST_DEFAULT_LIMIT = 20
export const DATE_RANGE_LIST_MAX_LIMIT = 50
export const DATE_RANGE_LIST_FETCH_MAX_LIMIT = DATE_RANGE_LIST_MAX_LIMIT + 1
export const DATE_RANGE_PREVIEW_MAX_CHARS = 80
export const DATE_RANGE_SNIPPET_MAX_CHARS = 160

export type SessionInDateRangeRow = {
  sessionId: string
  sessionTitle: string
  firstCreatedAt: Date
  lastCreatedAt: Date
  messageCount: number
  preview: string
}

export type MessageInDateRangeRow = {
  role: string
  content: string
  sessionId: string
  sessionTitle: string
  createdAt: Date
}

/** 把本地日历日解析成当天的起止时间；非法日期返回 null。 */
export function resolveLocalCalendarDayRange(
  startDate?: string,
  endDate?: string
): { start: Date; end: Date } | null {
  const parse = (value: string | undefined, endOfDay: boolean): Date | null => {
    const trimmed = (value ?? '').trim()
    if (!isRealLocalCalendarDate(trimmed)) return null
    const [yearText, monthText, dayText] = trimmed.split('-')
    const year = Number(yearText)
    const month = Number(monthText) - 1
    const day = Number(dayText)
    return endOfDay
      ? new Date(year, month, day, 23, 59, 59, 999)
      : new Date(year, month, day, 0, 0, 0, 0)
  }
  const startRaw = (startDate ?? '').trim()
  const endRaw = (endDate ?? '').trim()
  if (startRaw && !isRealLocalCalendarDate(startRaw)) return null
  if (endRaw && !isRealLocalCalendarDate(endRaw)) return null
  const start = parse(startDate, false)
  const end = parse(endDate, true)
  if (!start && !end) return null
  return {
    start: start ?? new Date(0),
    end: end ?? new Date(9999, 11, 31, 23, 59, 59, 999)
  }
}

export function clampDateListLimit(limit?: number): number {
  if (limit == null || !Number.isFinite(limit) || limit <= 0) return DATE_RANGE_LIST_DEFAULT_LIMIT
  return Math.min(Math.floor(limit), DATE_RANGE_LIST_MAX_LIMIT)
}

/** 允许比展示上限多 1 条，供工具判断截断。 */
export function clampDateListFetchLimit(limit?: number): number {
  if (limit == null || !Number.isFinite(limit) || limit <= 0) return DATE_RANGE_LIST_DEFAULT_LIMIT
  return Math.min(Math.floor(limit), DATE_RANGE_LIST_FETCH_MAX_LIMIT)
}
