import type { CacheKey } from './cache-keys'

export interface CacheStoreHandle {
  invalidate(reason?: string): void
  clear(reason?: string): void
}

export class CacheRegistry {
  private readonly stores = new Map<CacheKey, CacheStoreHandle>()

  register(key: CacheKey, handle: CacheStoreHandle): () => void {
    this.stores.set(key, handle)
    return () => this.stores.delete(key)
  }

  invalidate(keys: Iterable<CacheKey>, reason?: string): void {
    for (const key of keys) {
      this.stores.get(key)?.invalidate(reason)
    }
  }

  clear(keys: Iterable<CacheKey>, reason?: string): void {
    for (const key of keys) {
      this.stores.get(key)?.clear(reason)
    }
  }

  clearAll(reason?: string): void {
    for (const handle of this.stores.values()) {
      handle.clear(reason)
    }
  }
}

export const globalCacheRegistry = new CacheRegistry()
