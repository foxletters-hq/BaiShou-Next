import { describe, expect, it } from 'vitest'
import { buildSharedMemoryPreviewChips } from '../shared-memory-preview.util'

describe('buildSharedMemoryPreviewChips', () => {
  it('should keep only positive counts when some buckets are empty', () => {
    const chips = buildSharedMemoryPreviewChips(
      {
        diary: 2,
        yearly: 0,
        quarterly: 1,
        monthly: 0,
        weekly: 3,
        total: 6,
        estimatedChars: 10,
        estimatedTokens: 4
      },
      (key, fallback) => fallback
    )
    expect(chips.map((item) => item.key)).toEqual(['diary', 'quarterly', 'weekly'])
  })
})
