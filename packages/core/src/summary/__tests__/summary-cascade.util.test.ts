import { describe, it, expect } from 'vitest'
import { quarterlySummariesForMonthCascade } from '../summary-cascade.util'

describe('quarterlySummariesForMonthCascade', () => {
  const q = (label: string, end: string) => ({ label, endDate: end })

  it('returns empty when at most one quarterly summary exists', () => {
    expect(quarterlySummariesForMonthCascade([])).toEqual([])
    expect(quarterlySummariesForMonthCascade([q('Q2', '2026-06-30')])).toEqual([])
  })

  it('excludes the most recent quarterly summary by endDate', () => {
    const q1 = q('Q1', '2026-03-31')
    const q2 = q('Q2', '2026-06-30')
    const q3 = q('Q3', '2026-09-30')

    const result = quarterlySummariesForMonthCascade([q1, q2, q3])
    expect(result.map((x) => x.label).sort()).toEqual(['Q1', 'Q2'])
  })

  it('picks latest by endDate even when input order differs', () => {
    const q2 = q('Q2', '2026-06-30')
    const q3 = q('Q3', '2026-09-30')

    const result = quarterlySummariesForMonthCascade([q3, q2])
    expect(result).toEqual([q2])
  })
})
