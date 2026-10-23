import { formatLocalDate } from '@baishou/shared'

export interface CalendarDayCell {
  date: Date
  year: number
  month: number
  day: number
  ymd: string
  isCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
  isDisabled: boolean
}

export function parseDateInput(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  const trimmed = String(value).trim()
  if (!trimmed) return null
  const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1]!, 10)
    const m = parseInt(ymdMatch[2]!, 10)
    const d = parseInt(ymdMatch[3]!, 10)
    const dt = new Date(y, m - 1, d)
    if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) {
      return dt
    }
    return null
  }
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function getCalendarDays(
  viewYear: number,
  viewMonth: number,
  selectedDate: Date | null,
  minDate?: Date | string | null,
  maxDate?: Date | string | null
): CalendarDayCell[] {
  const todayYmd = formatLocalDate(new Date())
  const selectedYmd = selectedDate ? formatLocalDate(selectedDate) : ''
  const minYmd = minDate
    ? typeof minDate === 'string'
      ? minDate.trim()
      : formatLocalDate(minDate)
    : ''
  const maxYmd = maxDate
    ? typeof maxDate === 'string'
      ? maxDate.trim()
      : formatLocalDate(maxDate)
    : ''

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay()
  const startOffset = (firstDayOfMonth + 6) % 7

  const days: CalendarDayCell[] = []
  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(viewYear, viewMonth, 1 - startOffset + i)
    const y = cellDate.getFullYear()
    const m = cellDate.getMonth()
    const d = cellDate.getDate()
    const ymd = formatLocalDate(cellDate)
    const isCurrentMonth = m === viewMonth
    const isToday = ymd === todayYmd
    const isSelected = selectedYmd ? ymd === selectedYmd : false
    const isDisabled = Boolean((minYmd && ymd < minYmd) || (maxYmd && ymd > maxYmd))

    days.push({
      date: cellDate,
      year: y,
      month: m,
      day: d,
      ymd,
      isCurrentMonth,
      isToday,
      isSelected,
      isDisabled
    })
  }

  return days
}

export function getDecadeYears(viewYear: number): number[] {
  const startYear = Math.floor(viewYear / 10) * 10
  const years: number[] = []
  for (let y = startYear - 1; y <= startYear + 10; y++) {
    years.push(y)
  }
  return years
}
