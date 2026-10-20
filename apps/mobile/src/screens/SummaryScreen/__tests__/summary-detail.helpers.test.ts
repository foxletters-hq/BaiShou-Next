import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import { buildSummaryTitle } from '../utils/buildSummaryTitle'
import {
  buildSummaryTaskKey,
  parseSummaryBoundaryDate,
  summaryDateToStorageKey
} from '../utils/summary-detail.helpers'

describe('summary calendar dates', () => {
  it('normalizes date-time strings to the original calendar day', () => {
    expect(summaryDateToStorageKey('2026-03-31T00:00:00.000Z')).toBe('2026-03-31')
  })

  it('builds a stable task key from the calendar date instead of a timestamp', () => {
    expect(buildSummaryTaskKey('weekly', '2026-03-31')).toBe('weekly_2026-03-31')
  })

  it('restores a local-midnight instant to the same local calendar day', () => {
    const prevTz = process.env.TZ
    process.env.TZ = 'Asia/Shanghai'
    try {
      expect(summaryDateToStorageKey('2026-03-30T16:00:00.000Z')).toBe('2026-03-31')
    } finally {
      if (prevTz === undefined) delete process.env.TZ
      else process.env.TZ = prevTz
    }
  })

  it('parses summary boundaries as local calendar days', () => {
    const date = parseSummaryBoundaryDate('2026-03-31')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(2)
    expect(date.getDate()).toBe(31)
  })

  it('derives summary titles from the original calendar day in negative timezones', () => {
    const prevTz = process.env.TZ
    process.env.TZ = 'America/New_York'
    try {
      const t = ((key: string) =>
        key === 'summary.title_monthly' ? '$year-$month' : key) as unknown as TFunction
      const title = buildSummaryTitle({ type: 'monthly', startDate: '2026-01-01' }, t)
      expect(title).toBe('2026-1')
    } finally {
      if (prevTz === undefined) delete process.env.TZ
      else process.env.TZ = prevTz
    }
  })
})
