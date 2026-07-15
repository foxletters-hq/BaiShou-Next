import { describe, expect, it } from 'vitest'
import { computeLookbackCutoffDate, computeSharedMemoryCopyPreview } from '../summary-context'

describe('computeLookbackCutoffDate', () => {
  it('anchors lookback to the reference date, not wall-clock now', () => {
    const periodStart = new Date(2025, 2, 3) // 2025-03-03
    const cutoff = computeLookbackCutoffDate(3, periodStart)
    expect(cutoff.getFullYear()).toBe(2024)
    expect(cutoff.getMonth()).toBe(11) // December
    expect(cutoff.getDate()).toBe(1)
  })
})

describe('computeSharedMemoryCopyPreview', () => {
  it('excludes memories on/after untilExclusive (generation inject window)', () => {
    const periodStart = new Date(2025, 2, 3) // week starting 2025-03-03
    const preview = computeSharedMemoryCopyPreview(
      [
        {
          type: 'weekly',
          startDate: new Date(2025, 1, 24),
          endDate: new Date(2025, 2, 2),
          content: 'before'
        },
        {
          type: 'weekly',
          startDate: periodStart,
          endDate: new Date(2025, 2, 9),
          content: 'same-period'
        },
        {
          type: 'monthly',
          startDate: new Date(2026, 5, 1),
          endDate: new Date(2026, 5, 30),
          content: 'future-leak'
        }
      ],
      [],
      6,
      { referenceDate: periodStart, untilExclusive: periodStart }
    )

    expect(preview.weekly).toBe(1)
    expect(preview.monthly).toBe(0)
    expect(preview.total).toBe(1)
  })

  it('keeps monthly summaries visible when only the latest quarterly summary exists', () => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const preview = computeSharedMemoryCopyPreview(
      [
        {
          type: 'quarterly',
          startDate: monthStart,
          endDate: now
        },
        {
          type: 'monthly',
          startDate: monthStart,
          endDate: now
        }
      ],
      [],
      6
    )

    expect(preview.quarterly).toBe(1)
    expect(preview.monthly).toBe(1)
    expect(preview.total).toBe(2)
    expect(preview.estimatedChars).toBeGreaterThan(0)
    expect(preview.estimatedTokens).toBeGreaterThan(0)
  })

  it('hides monthly summaries covered by older quarterly summaries', () => {
    const q1Start = new Date(2026, 0, 1)
    const q1End = new Date(2026, 2, 31)
    const q2Start = new Date(2026, 3, 1)
    const q2End = new Date(2026, 5, 30)
    const marchMonthlyStart = new Date(2026, 2, 1)

    const preview = computeSharedMemoryCopyPreview(
      [
        {
          type: 'quarterly',
          startDate: q1Start,
          endDate: q1End
        },
        {
          type: 'quarterly',
          startDate: q2Start,
          endDate: q2End
        },
        {
          type: 'monthly',
          startDate: marchMonthlyStart,
          endDate: q1End
        }
      ],
      [],
      12
    )

    expect(preview.quarterly).toBe(2)
    expect(preview.monthly).toBe(0)
    expect(preview.total).toBe(2)
    expect(preview.estimatedChars).toBeGreaterThan(0)
    expect(preview.estimatedTokens).toBeGreaterThan(0)
  })

  it('includes user copy prefix in size estimate', () => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const withoutPrefix = computeSharedMemoryCopyPreview(
      [
        {
          type: 'monthly',
          startDate: monthStart,
          endDate: now,
          content: 'hello memory'
        }
      ],
      [],
      6,
      { locale: 'zh' }
    )

    const withPrefix = computeSharedMemoryCopyPreview(
      [
        {
          type: 'monthly',
          startDate: monthStart,
          endDate: now,
          content: 'hello memory'
        }
      ],
      [],
      6,
      { locale: 'zh', userCopyPrefix: 'Hi, AI!' }
    )

    expect(withPrefix.estimatedChars).toBeGreaterThan(withoutPrefix.estimatedChars)
    expect(withPrefix.estimatedTokens).toBeGreaterThan(withoutPrefix.estimatedTokens)
  })
})
