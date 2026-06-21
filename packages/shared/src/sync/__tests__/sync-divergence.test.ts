import { describe, expect, it } from 'vitest'
import type { SyncManifest } from '../../types/version-control.types'
import {
  assertBidirectionalSyncDivergenceAllowed,
  computeManifestDivergencePercent,
  shouldSkipSyncDivergenceCheck,
  SyncDivergenceConfirmationRequiredError,
  SyncDivergenceExceededError
} from '../sync-divergence'

function manifest(files: Record<string, string>): SyncManifest {
  return {
    version: 1,
    updatedAt: 0,
    deviceId: 'd',
    files: Object.fromEntries(
      Object.entries(files).map(([path, hash]) => [path, { hash, size: 1, lastModified: 0 }])
    )
  }
}

describe('sync-divergence', () => {
  it('computes divergence as percent of differing paths', () => {
    const local = manifest({ a: '1', b: '2', c: '3' })
    const remote = manifest({ a: '1', b: 'x', d: '4' })
    expect(computeManifestDivergencePercent(local, remote)).toBe(75)
  })

  it('allows sync when divergence is within threshold', () => {
    const local = manifest({ a: '1', b: '2' })
    const remote = manifest({ a: '1', b: 'x' })
    expect(() =>
      assertBidirectionalSyncDivergenceAllowed(
        local,
        remote,
        { maxDivergencePercent: 50 },
        {
          storageHistory: 'match'
        }
      )
    ).not.toThrow()
    expect(() =>
      assertBidirectionalSyncDivergenceAllowed(
        local,
        remote,
        { maxDivergencePercent: 40 },
        {
          storageHistory: 'match'
        }
      )
    ).toThrow(SyncDivergenceExceededError)
  })

  it('null threshold is treated as 100 (remove protection)', () => {
    const local = manifest({ a: '1' })
    const remote = manifest({ b: '2' })
    expect(() =>
      assertBidirectionalSyncDivergenceAllowed(
        local,
        remote,
        { maxDivergencePercent: null },
        {
          storageHistory: 'match'
        }
      )
    ).not.toThrow()
    expect(computeManifestDivergencePercent(local, remote)).toBe(100)
  })

  it('requires confirmation on first sync when both sides have data and divergence is high', () => {
    const local = manifest({ a: '1', b: '2' })
    const remote = manifest({ c: '3', d: '4' })
    expect(() =>
      assertBidirectionalSyncDivergenceAllowed(
        local,
        remote,
        { maxDivergencePercent: 10 },
        {
          storageHistory: 'none'
        }
      )
    ).toThrow(SyncDivergenceConfirmationRequiredError)
    expect(() =>
      assertBidirectionalSyncDivergenceAllowed(
        local,
        remote,
        { maxDivergencePercent: 10 },
        {
          storageHistory: 'none',
          highDivergenceConfirmed: true
        }
      )
    ).not.toThrow()
  })

  it('skips when one side has no files', () => {
    const local = manifest({})
    const remote = manifest({ a: '1', b: '2' })
    expect(shouldSkipSyncDivergenceCheck(local, remote)).toBe(true)
    expect(() =>
      assertBidirectionalSyncDivergenceAllowed(
        local,
        remote,
        { maxDivergencePercent: 10 },
        {
          storageHistory: 'match'
        }
      )
    ).not.toThrow()
  })

  it('still blocks when storage target mismatches and both sides have data', () => {
    const local = manifest({ a: '1', b: '2' })
    const remote = manifest({ c: '3', d: '4' })
    expect(() =>
      assertBidirectionalSyncDivergenceAllowed(
        local,
        remote,
        { maxDivergencePercent: 10 },
        {
          storageHistory: 'mismatch'
        }
      )
    ).toThrow(SyncDivergenceExceededError)
  })
})
