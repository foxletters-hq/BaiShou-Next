/**
 * 工具侧本地日历日校验。仓储层仍用 resolveLocalCalendarDayRange 做含首尾比较。
 */

import { isRealLocalCalendarDate } from '@baishou/shared'

export function isLocalCalendarDate(value: string | undefined): boolean {
  return isRealLocalCalendarDate(value)
}

export function validateRequiredCalendarDateRange(
  startDate: string | undefined,
  endDate: string | undefined
): { startDate: string; endDate: string } | { error: string } {
  const start = (startDate ?? '').trim()
  const end = (endDate ?? '').trim()
  if (!isLocalCalendarDate(start) || !isLocalCalendarDate(end)) {
    return { error: 'Error: Invalid date format. Expected YYYY-MM-DD.' }
  }
  if (start > end) {
    return { error: 'Error: start_date 不能晚于 end_date。' }
  }
  return { startDate: start, endDate: end }
}

export function validateOptionalCalendarDateRange(
  startDate: string | undefined,
  endDate: string | undefined
): { startDate?: string; endDate?: string } | { error: string } {
  const start = (startDate ?? '').trim()
  const end = (endDate ?? '').trim()
  if (start && !isLocalCalendarDate(start)) {
    return { error: 'Error: Invalid date format. Expected YYYY-MM-DD.' }
  }
  if (end && !isLocalCalendarDate(end)) {
    return { error: 'Error: Invalid date format. Expected YYYY-MM-DD.' }
  }
  if (start && end && start > end) {
    return { error: 'Error: start_date 不能晚于 end_date。' }
  }
  if (!start && !end) {
    return {}
  }
  return {
    ...(start ? { startDate: start } : {}),
    ...(end ? { endDate: end } : {})
  }
}

export function formatCalendarDateRangeLabel(startDate?: string, endDate?: string): string {
  if (startDate && endDate) return `${startDate} ~ ${endDate}`
  if (startDate) return `${startDate} 起`
  if (endDate) return `截至 ${endDate}`
  return ''
}

export const TOOL_DATE_LIST_DEFAULT_LIMIT = 20
export const TOOL_DATE_LIST_MAX_LIMIT = 50
export const TOOL_DATE_LIST_FETCH_MAX_LIMIT = TOOL_DATE_LIST_MAX_LIMIT + 1

export function clampToolDateListLimit(limit?: number): number {
  if (limit == null || !Number.isFinite(limit) || limit <= 0) return TOOL_DATE_LIST_DEFAULT_LIMIT
  return Math.min(Math.floor(limit), TOOL_DATE_LIST_MAX_LIMIT)
}

/** 允许比展示上限多 1 条，供工具判断「该时段可能还有更多」。 */
export function clampToolDateListFetchLimit(limit?: number): number {
  if (limit == null || !Number.isFinite(limit) || limit <= 0) return TOOL_DATE_LIST_DEFAULT_LIMIT
  return Math.min(Math.floor(limit), TOOL_DATE_LIST_FETCH_MAX_LIMIT)
}
