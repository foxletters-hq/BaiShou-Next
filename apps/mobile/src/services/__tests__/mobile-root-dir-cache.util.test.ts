import { describe, expect, it, vi } from 'vitest'
import type { IFileSystem } from '@baishou/core-mobile'
import {
  getCachedVerifiedRoot,
  invalidateCachedVerifiedRoot,
  isRootNoMediaEnsured,
  markRootNoMediaEnsured,
  MOBILE_ROOT_VERIFY_TTL_MS,
  resolveRootWithInFlightDedup,
  setCachedVerifiedRoot
} from '../mobile-root-dir-cache.util'

describe('mobile-root-dir-cache.util', () => {
  it('caches verified root per IFileSystem within TTL and expires afterwards', () => {
    const fsA = {} as IFileSystem
    const fsB = {} as IFileSystem

    setCachedVerifiedRoot(fsA, '/storage/emulated/124/0312', 1_000)

    expect(getCachedVerifiedRoot(fsA, 1_000 + MOBILE_ROOT_VERIFY_TTL_MS - 1)).toBe(
      '/storage/emulated/124/0312'
    )
    expect(getCachedVerifiedRoot(fsB, 1_000)).toBeNull()
    expect(getCachedVerifiedRoot(fsA, 1_000 + MOBILE_ROOT_VERIFY_TTL_MS)).toBeNull()
  })

  it('invalidates cached root and optionally resets noMedia marker tracking', () => {
    const fs = {} as IFileSystem
    setCachedVerifiedRoot(fs, '/storage/emulated/0/BaiShou_Root', 5_000)
    markRootNoMediaEnsured(fs, '/storage/emulated/0/BaiShou_Root')

    invalidateCachedVerifiedRoot(fs, false)
    expect(getCachedVerifiedRoot(fs, 5_001)).toBeNull()
    expect(isRootNoMediaEnsured(fs, '/storage/emulated/0/BaiShou_Root')).toBe(true)

    invalidateCachedVerifiedRoot(fs, true)
    expect(isRootNoMediaEnsured(fs, '/storage/emulated/0/BaiShou_Root')).toBe(false)
  })

  it('deduplicates concurrent root probes and ignores stale completion after invalidation', async () => {
    const fs = {} as IFileSystem
    let resolveFirst!: (value: string) => void
    const loader = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFirst = resolve
        })
    )

    const p1 = resolveRootWithInFlightDedup(fs, loader)
    const p2 = resolveRootWithInFlightDedup(fs, loader)
    expect(loader).toHaveBeenCalledTimes(1)

    resolveFirst('/storage/emulated/0/BaiShou_Root')
    await expect(Promise.all([p1, p2])).resolves.toEqual([
      '/storage/emulated/0/BaiShou_Root',
      '/storage/emulated/0/BaiShou_Root'
    ])
    expect(getCachedVerifiedRoot(fs)).toBe('/storage/emulated/0/BaiShou_Root')

    // 若探测进行中发生目录切换失效，旧探测完成不得污染新缓存
    invalidateCachedVerifiedRoot(fs, true)
    let resolveStale!: (value: string) => void
    const stalePromise = resolveRootWithInFlightDedup(
      fs,
      () =>
        new Promise<string>((resolve) => {
          resolveStale = resolve
        })
    )
    invalidateCachedVerifiedRoot(fs, true)
    resolveStale('/storage/emulated/0/OldRoot')
    await stalePromise
    expect(getCachedVerifiedRoot(fs)).toBeNull()
  })
})
