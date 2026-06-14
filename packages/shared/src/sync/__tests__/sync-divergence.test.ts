import { describe, expect, it } from 'vitest'
import type { SyncManifest } from '../../types/version-control.types'
import {
  assertBidirectionalSyncDivergenceAllowed,
  computeManifestDivergencePercent,
  SyncDivergenceExceededError
} from '../sync-divergence'

function manifest(files: Record<string, string>): SyncManifest {
  return {
    version: 1,
    updatedAt: 0,
    deviceId: 'd',
    files: Object.fromEntries(
      Object.entries(files).map(([path, hash]) => [
        path,
        { hash, size: 1, lastModified: 0 }
      ])
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
      assertBidirectionalSyncDivergenceAllowed(local, remote, { maxDivergencePercent: 50 })
    ).not.toThrow()
    expect(() =>
      assertBidirectionalSyncDivergenceAllowed(local, remote, { maxDivergencePercent: 40 })
    ).toThrow(SyncDivergenceExceededError)
  })

  it('null threshold is treated as 100 (remove protection)', () => {
    const local = manifest({ a: '1' })
    const remote = manifest({ b: '2' })
    expect(() =>
      assertBidirectionalSyncDivergenceAllowed(local, remote, { maxDivergencePercent: null })
    ).not.toThrow()
    expect(computeManifestDivergencePercent(local, remote)).toBe(100)
  })
})
