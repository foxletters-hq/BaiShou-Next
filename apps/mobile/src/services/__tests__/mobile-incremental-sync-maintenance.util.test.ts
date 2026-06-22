import { describe, expect, it } from 'vitest'
import type { SyncManifest } from '@baishou/shared'
import { hasRemoteManifestDrift } from '../mobile-incremental-plan-reuse.util'

describe('hasRemoteManifestDrift', () => {
  const baseline: SyncManifest = {
    version: 1,
    updatedAt: 1,
    deviceId: 'd',
    files: {
      'note.md': { hash: 'a', size: 3, lastModified: 10 }
    }
  }

  it('远端新增文件视为漂移', () => {
    const fresh: SyncManifest = {
      ...baseline,
      files: {
        ...baseline.files,
        'other.md': { hash: 'b', size: 4, lastModified: 20 }
      }
    }
    expect(hasRemoteManifestDrift(baseline, fresh)).toBe(true)
  })

  it('完全一致时不漂移', () => {
    expect(hasRemoteManifestDrift(baseline, baseline)).toBe(false)
  })
})

describe('awaitPostSyncMaintenance generation guard', () => {
  it('仅 await 当前代次的 maintenance promise', async () => {
    const generations: number[] = []
    let generation = 0
    let currentPromise: Promise<void> | null = null

    const startMaintenance = () => {
      const gen = ++generation
      currentPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          generations.push(gen)
          resolve()
        }, gen === 1 ? 30 : 5)
      })
      return currentPromise
    }

    const p1 = startMaintenance()
    const p2 = startMaintenance()

    await p2
    expect(generations).toEqual([2])

    await p1
    expect(generations).toEqual([2, 1])
  })
})
