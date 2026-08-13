import { describe, expect, it } from 'vitest'
import {
  clampGraphMonthRange,
  defaultGraphMonthRange,
  formatGraphMonth,
  isDefaultGraphMonthRange,
  isGraphEdgeInMonthRange,
  parseGraphMonthToDate,
  resolveGraphEdgeMonth
} from '../graph-month-range.util'

describe('graph-month-range.util', () => {
  it('defaults to inclusive last 3 months', () => {
    const now = new Date(2026, 7, 5) // Aug 2026
    expect(defaultGraphMonthRange(now)).toEqual({
      startMonth: '2026-06',
      endMonth: '2026-08'
    })
  })

  it('clamps and swaps inverted ranges', () => {
    expect(clampGraphMonthRange({ startMonth: '2026-09', endMonth: '2026-06' })).toEqual({
      startMonth: '2026-06',
      endMonth: '2026-09'
    })
  })

  it('detects default range', () => {
    const now = new Date(2026, 7, 5)
    expect(isDefaultGraphMonthRange(defaultGraphMonthRange(now), now)).toBe(true)
    expect(
      isDefaultGraphMonthRange({ startMonth: '2025-01', endMonth: '2026-08' }, now)
    ).toBe(false)
  })

  it('parses and formats month', () => {
    expect(formatGraphMonth(parseGraphMonthToDate('2026-03'))).toBe('2026-03')
  })

  it('resolves edge month from shardMonth, sourceRef, then createdAt', () => {
    expect(resolveGraphEdgeMonth({ shardMonth: '2025-11' })).toBe('2025-11')
    expect(resolveGraphEdgeMonth({ shardMonth: '', sourceRef: '2024-03-15' })).toBe('2024-03')
    expect(resolveGraphEdgeMonth({ shardMonth: '', sourceRef: 'Journals/2024/07/01.md' })).toBe(
      '2024-07'
    )
    expect(
      resolveGraphEdgeMonth({
        shardMonth: '',
        sourceRef: null,
        createdAt: new Date(2023, 0, 20).getTime()
      })
    ).toBe('2023-01')
    expect(resolveGraphEdgeMonth({ shardMonth: '', sourceRef: 'no-date' })).toBe(null)
  })

  it('filters edges by inclusive month range', () => {
    const range = { startMonth: '2026-01', endMonth: '2026-03' }
    expect(isGraphEdgeInMonthRange({ shardMonth: '2026-02' }, range)).toBe(true)
    expect(isGraphEdgeInMonthRange({ shardMonth: '2025-12' }, range)).toBe(false)
    expect(isGraphEdgeInMonthRange({ shardMonth: '', sourceRef: '2026-03-01' }, range)).toBe(true)
    expect(isGraphEdgeInMonthRange({ shardMonth: '', sourceRef: 'x' }, range)).toBe(false)
  })
})
