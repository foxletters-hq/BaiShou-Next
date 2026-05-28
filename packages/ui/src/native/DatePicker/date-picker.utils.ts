import { getPickerYearRange } from '../YearMonthPicker/year-month-picker.utils'

export const WHEEL_ITEM_HEIGHT = 44
export const WHEEL_PAD_COUNT = 2

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
