import type { IFileSystem } from '@baishou/core-mobile'

export const MOBILE_ROOT_VERIFY_TTL_MS = 60_000

interface VerifiedRootCacheEntry {
  verifiedPath?: string
  verifiedAt?: number
  noMediaEnsuredPath?: string
  inFlightPromise?: Promise<string>
  generation: number
}

/** 按 IFileSystem 实例隔离存储根验证缓存：forVault 共享同一缓存，单测不同 mock 互不干扰 */
const cacheByFileSystem = new WeakMap<IFileSystem, VerifiedRootCacheEntry>()

function getEntry(fs: IFileSystem): VerifiedRootCacheEntry {
  let entry = cacheByFileSystem.get(fs)
  if (!entry) {
    entry = { generation: 0 }
    cacheByFileSystem.set(fs, entry)
  }
  return entry
}

export function getCachedVerifiedRoot(fs: IFileSystem, now = Date.now()): string | null {
  const entry = cacheByFileSystem.get(fs)
  if (!entry?.verifiedPath || entry.verifiedAt == null) return null
  if (now - entry.verifiedAt >= MOBILE_ROOT_VERIFY_TTL_MS) return null
  return entry.verifiedPath
}

export function setCachedVerifiedRoot(fs: IFileSystem, rootPath: string, now = Date.now()): void {
  const entry = getEntry(fs)
  entry.verifiedPath = rootPath
  entry.verifiedAt = now
}

export function invalidateCachedVerifiedRoot(fs: IFileSystem, clearNoMedia = false): void {
  const entry = cacheByFileSystem.get(fs)
  if (!entry) return
  entry.generation += 1
  entry.verifiedPath = undefined
  entry.verifiedAt = undefined
  entry.inFlightPromise = undefined
  if (clearNoMedia) {
    entry.noMediaEnsuredPath = undefined
  }
}

/**
 * 合并同一时刻并发的 getRootDirectory() 可写性探测，避免多处冷启动并发争抢创建/删除同一个 .write_test。
 * 若探测期间发生 updateRootDirectory/invalidate，代数不匹配时不回写过期结果。
 */
export function resolveRootWithInFlightDedup(
  fs: IFileSystem,
  loader: () => Promise<string>,
  now = Date.now()
): Promise<string> {
  const cached = getCachedVerifiedRoot(fs, now)
  if (cached) return Promise.resolve(cached)

  const entry = getEntry(fs)
  if (entry.inFlightPromise) {
    return entry.inFlightPromise
  }

  const gen = entry.generation
  const promise = loader()
    .then((resolved) => {
      if (entry.generation === gen) {
        entry.verifiedPath = resolved
        entry.verifiedAt = Date.now()
      }
      return resolved
    })
    .finally(() => {
      if (entry.inFlightPromise === promise) {
        entry.inFlightPromise = undefined
      }
    })
  entry.inFlightPromise = promise
  return promise
}

export function isRootNoMediaEnsured(fs: IFileSystem, rootPath: string): boolean {
  return cacheByFileSystem.get(fs)?.noMediaEnsuredPath === rootPath
}

export function markRootNoMediaEnsured(fs: IFileSystem, rootPath: string): void {
  getEntry(fs).noMediaEnsuredPath = rootPath
}
