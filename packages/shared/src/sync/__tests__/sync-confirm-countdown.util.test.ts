import { describe, expect, it } from 'vitest'
import {
  SYNC_CONFIRM_DELAY_MS,
  SyncConfirmNotReadyError,
  assertSyncConfirmAllowed,
  assertSyncConfirmReady,
  computeSyncConfirmSecondsLeft,
  getSyncConfirmEligibleAt,
  isSyncConfirmReady,
  resolvePlanConfirmEligibleAt
} from '../sync-confirm-countdown.util'

describe('sync-confirm-countdown.util', () => {
  it('counts down seconds until delay elapses', () => {
    expect(computeSyncConfirmSecondsLeft(0)).toBe(2)
    expect(computeSyncConfirmSecondsLeft(999)).toBe(2)
    expect(computeSyncConfirmSecondsLeft(1000)).toBe(1)
    expect(computeSyncConfirmSecondsLeft(1999)).toBe(1)
    expect(computeSyncConfirmSecondsLeft(2000)).toBe(0)
    expect(computeSyncConfirmSecondsLeft(5000)).toBe(0)
  })

  it('marks confirm ready only after full delay', () => {
    expect(isSyncConfirmReady(0)).toBe(false)
    expect(isSyncConfirmReady(1999)).toBe(false)
    expect(isSyncConfirmReady(2000)).toBe(true)
    expect(isSyncConfirmReady(3000)).toBe(true)
  })

  it('computes eligible timestamp from start time', () => {
    expect(getSyncConfirmEligibleAt(1000)).toBe(1000 + SYNC_CONFIRM_DELAY_MS)
  })

  it('assertSyncConfirmReady throws before eligible time', () => {
    expect(() => assertSyncConfirmReady(5000, 4000)).toThrow(SyncConfirmNotReadyError)
    expect(() => assertSyncConfirmReady(5000, 5000)).not.toThrow()
    expect(() => assertSyncConfirmReady(5000, 6000)).not.toThrow()
  })

  it('resolvePlanConfirmEligibleAt skips delay when sync cannot execute', () => {
    const startedAt = 1000
    expect(
      resolvePlanConfirmEligibleAt(
        { changeCount: 0, deletePropagationBlocked: false },
        startedAt
      )
    ).toBe(startedAt)
    expect(
      resolvePlanConfirmEligibleAt(
        { changeCount: 3, deletePropagationBlocked: true },
        startedAt
      )
    ).toBe(startedAt)
    expect(
      resolvePlanConfirmEligibleAt(
        { changeCount: 3, deletePropagationBlocked: false },
        startedAt
      )
    ).toBe(startedAt + SYNC_CONFIRM_DELAY_MS)
  })

  it('assertSyncConfirmAllowed fails closed when eligibleAt is null', () => {
    expect(() =>
      assertSyncConfirmAllowed({ canExecuteSync: true, eligibleAtMs: null })
    ).toThrow(SyncConfirmNotReadyError)
  })
})
