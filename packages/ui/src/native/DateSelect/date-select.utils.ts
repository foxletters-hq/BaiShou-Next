export const WHEEL_ITEM_HEIGHT = 44
export const WHEEL_PAD_COUNT = 2

/** 从 2000 年到当前年份 +30 年 */
export function getPickerYearRange(): number[] {
  const currentYear = new Date().getFullYear()
  const startYear = 2000
  const endYear = currentYear + 30
  const length = endYear - startYear + 1
  return Array.from({ length }, (_, i) => startYear + i)
}

export function getDatePickerYears(): number[] {
  return getPickerYearRange()
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

export function clampDateParts(year: number, monthIndex: number, day: number): Date {
  const maxDay = daysInMonth(year, monthIndex)
  return new Date(year, monthIndex, Math.min(Math.max(1, day), maxDay))
}

export function scrollIndexToOffset(index: number): number {
  return index * WHEEL_ITEM_HEIGHT
}

export function offsetToScrollIndex(offsetY: number): number {
  return Math.max(0, Math.round(offsetY / WHEEL_ITEM_HEIGHT))
}

type MonthFormatT = (key: string, options?: Record<string, unknown>) => string

export function formatMonthNumberLabel(month: number, t: MonthFormatT): string {
  return `${month}${t('common.month_suffix')}`
}

export function formatYearMonthLabel(year: number, monthIndex: number, t: MonthFormatT): string {
  return t('common.year_month_label', { year, month: monthIndex + 1 })
}

export function getMonthWheelLabels(t: MonthFormatT): string[] {
  return Array.from({ length: 12 }, (_, i) => formatMonthNumberLabel(i + 1, t))
}

export function getDayWheelLabels(year: number, monthIndex: number): string[] {
  const count = daysInMonth(year, monthIndex)
  return Array.from({ length: count }, (_, i) => String(i + 1).padStart(2, '0'))
}
