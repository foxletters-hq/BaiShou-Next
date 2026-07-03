import { describe, expect, it } from 'vitest'
import {
  formatVectorSearchDateRangeLabel,
  resolveVectorSearchDateRange
} from '../vector-search-date-filter.util'

describe('resolveVectorSearchDateRange', () => {
  it('parses start and end dates as local day bounds', () => {
    const range = resolveVectorSearchDateRange('2024-03-01', '2024-03-31')
    expect('error' in range).toBe(false)
    if ('error' in range) return

    expect(range.startMs).toBe(new Date(2024, 2, 1).getTime())
    expect(range.endMs).toBe(new Date(2024, 2, 31).getTime() + 24 * 60 * 60 * 1000 - 1)
  })

  it('rejects invalid date strings', () => {
    const range = resolveVectorSearchDateRange('bad-date', undefined)
    expect(range).toEqual({ error: '无效的开始日期 "bad-date"，请使用 YYYY-MM-DD 格式。' })
  })

  it('rejects start after end', () => {
    const range = resolveVectorSearchDateRange('2024-06-01', '2024-05-01')
    expect(range).toEqual({ error: '开始日期不能晚于结束日期。' })
  })
})

describe('formatVectorSearchDateRangeLabel', () => {
  it('formats open-ended ranges', () => {
    expect(formatVectorSearchDateRangeLabel('2024-01-01', undefined)).toBe('2024-01-01 起')
    expect(formatVectorSearchDateRangeLabel(undefined, '2024-12-31')).toBe('至 2024-12-31')
    expect(formatVectorSearchDateRangeLabel('2024-01-01', '2024-06-30')).toBe(
      '2024-01-01 ~ 2024-06-30'
    )
  })
})
