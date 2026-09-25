import { describe, expect, it } from 'vitest'
import {
  clampToolDateListFetchLimit,
  clampToolDateListLimit,
  formatCalendarDateRangeLabel,
  isLocalCalendarDate,
  validateOptionalCalendarDateRange,
  validateRequiredCalendarDateRange
} from '../calendar-date-range.util'

describe('calendar-date-range.util', () => {
  it('should accept YYYY-MM-DD local calendar dates', () => {
    expect(isLocalCalendarDate('2026-09-07')).toBe(true)
    expect(isLocalCalendarDate('not-a-date')).toBe(false)
    expect(isLocalCalendarDate('')).toBe(false)
    expect(isLocalCalendarDate('2026-02-31')).toBe(false)
  })

  it('should require both dates and reject inverted ranges', () => {
    expect(validateRequiredCalendarDateRange('2026-09-01', '2026-09-07')).toEqual({
      startDate: '2026-09-01',
      endDate: '2026-09-07'
    })
    expect(validateRequiredCalendarDateRange('2026-09-07', '2026-09-01')).toEqual({
      error: 'Error: start_date 不能晚于 end_date。'
    })
    const invalid = validateRequiredCalendarDateRange('bad', '2026-09-01')
    expect('error' in invalid && invalid.error).toContain('YYYY-MM-DD')
    const overflow = validateRequiredCalendarDateRange('2026-02-31', '2026-03-01')
    expect('error' in overflow && overflow.error).toContain('YYYY-MM-DD')
  })

  it('should allow a single bound when dates are optional', () => {
    expect(validateOptionalCalendarDateRange('2026-09-01', undefined)).toEqual({
      startDate: '2026-09-01'
    })
    expect(validateOptionalCalendarDateRange(undefined, undefined)).toEqual({})
    const inverted = validateOptionalCalendarDateRange('2026-09-07', '2026-09-01')
    expect('error' in inverted && inverted.error).toContain('不能晚于')
  })

  it('should clamp list limits to 1..50 and default to 20', () => {
    expect(clampToolDateListLimit(undefined)).toBe(20)
    expect(clampToolDateListLimit(0)).toBe(20)
    expect(clampToolDateListLimit(999)).toBe(50)
    expect(clampToolDateListLimit(3)).toBe(3)
  })

  it('should allow fetch limit one above the display max', () => {
    expect(clampToolDateListFetchLimit(51)).toBe(51)
    expect(clampToolDateListFetchLimit(999)).toBe(51)
  })

  it('should format a date range label', () => {
    expect(formatCalendarDateRangeLabel('2026-09-01', '2026-09-07')).toBe('2026-09-01 ~ 2026-09-07')
    expect(formatCalendarDateRangeLabel('2026-09-01')).toBe('2026-09-01 起')
    expect(formatCalendarDateRangeLabel(undefined, '2026-09-07')).toBe('截至 2026-09-07')
  })
})
