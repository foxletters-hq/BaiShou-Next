import { describe, expect, it } from 'vitest'
import { computeSharedMemoryCopyPreview } from '../summary-context'

describe('computeSharedMemoryCopyPreview', () => {
  it('hides monthly summaries covered by quarterly summaries in the same month', () => {
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
    expect(preview.monthly).toBe(0)
    expect(preview.total).toBe(1)
  })
})
