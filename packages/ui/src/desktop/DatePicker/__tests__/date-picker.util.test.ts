import { describe, expect, it } from 'vitest'
import { parseDateInput, getCalendarDays, getDecadeYears } from '../date-picker.util'

describe('date-picker.util', () => {
  describe('parseDateInput', () => {
    it('returns null for null, undefined, or empty string', () => {
      expect(parseDateInput(null)).toBeNull()
      expect(parseDateInput(undefined)).toBeNull()
      expect(parseDateInput('')).toBeNull()
      expect(parseDateInput('   ')).toBeNull()
    })

    it('returns valid Date unchanged', () => {
      const dt = new Date(2026, 8, 28)
      expect(parseDateInput(dt)).toBe(dt)
    })

    it('parses YYYY-MM-DD string accurately without UTC shift', () => {
      const parsed = parseDateInput('2026-09-28')
      expect(parsed).not.toBeNull()
      expect(parsed?.getFullYear()).toBe(2026)
      expect(parsed?.getMonth()).toBe(8)
      expect(parsed?.getDate()).toBe(28)
    })

    it('rejects invalid calendar dates like 2026-02-31', () => {
      expect(parseDateInput('2026-02-31')).toBeNull()
    })
  })

  describe('getCalendarDays', () => {
    it('generates 42 days grid for a month', () => {
      // September 2026: 2026-09-01 is Tuesday -> firstDayCol = 1 (Monday is 2026-08-31)
      const days = getCalendarDays(2026, 8, new Date(2026, 8, 28))
      expect(days).toHaveLength(42)

      // Cell 0 should be 2026-08-31 (prev month)
      expect(days[0]?.ymd).toBe('2026-08-31')
      expect(days[0]?.isCurrentMonth).toBe(false)

      // Cell 1 should be 2026-09-01 (current month)
      expect(days[1]?.ymd).toBe('2026-09-01')
      expect(days[1]?.isCurrentMonth).toBe(true)

      // Selected date 2026-09-28
      const selectedCell = days.find((d) => d.ymd === '2026-09-28')
      expect(selectedCell).toBeDefined()
      expect(selectedCell?.isSelected).toBe(true)
      expect(selectedCell?.isCurrentMonth).toBe(true)
    })

    it('applies minDate and maxDate limits', () => {
      const days = getCalendarDays(2026, 8, null, '2026-09-10', '2026-09-20')
      const beforeMin = days.find((d) => d.ymd === '2026-09-09')
      const inRange = days.find((d) => d.ymd === '2026-09-15')
      const afterMax = days.find((d) => d.ymd === '2026-09-21')

      expect(beforeMin?.isDisabled).toBe(true)
      expect(inRange?.isDisabled).toBe(false)
      expect(afterMax?.isDisabled).toBe(true)
    })
  })

  describe('getDecadeYears', () => {
    it('returns 12 years around decade', () => {
      const years = getDecadeYears(2026)
      expect(years).toHaveLength(12)
      expect(years[0]).toBe(2019)
      expect(years[1]).toBe(2020)
      expect(years[10]).toBe(2029)
      expect(years[11]).toBe(2030)
    })
  })
})
