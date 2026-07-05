import { describe, expect, it } from 'vitest'
import { computeSharedMemoryCopyPreview } from '../summary-context'

describe('computeSharedMemoryCopyPreview', () => {
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
  })
})
