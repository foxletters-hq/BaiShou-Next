import { describe, expect, it } from 'vitest'
import {
  isInterruptedSyncSessionResumable,
  shouldClearInterruptedSyncSessionOnPlan
} from '../mobile-incremental-sync-session.util'

describe('mobile-incremental-sync-session.util', () => {
  it('clears stale interrupted session when decision shape changed', () => {
    expect(
      shouldClearInterruptedSyncSessionOnPlan(
        {
          startedAt: 1,
          updatedAt: 2,
          total: 569,
          completed: 568,
          mode: 'sync'
        },
        120,
        0
      )
    ).toBe(true)
  })

  it('keeps resumable session when totals are close and changes remain', () => {
    const session = {
      startedAt: 1,
      updatedAt: 2,
      total: 120,
      completed: 80,
      mode: 'sync' as const
    }
    expect(shouldClearInterruptedSyncSessionOnPlan(session, 118, 0)).toBe(false)
    expect(isInterruptedSyncSessionResumable(session)).toBe(true)
  })
})
