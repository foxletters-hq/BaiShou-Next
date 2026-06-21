import type { CacheKey } from './cache-keys'
import { globalCacheRegistry } from './cache-registry'
import { createInvalidationEpochStore } from './invalidation-epoch'

const DIARY_LIST_CACHE_KEY = 'diary.list' satisfies CacheKey

const diaryListEpoch = createInvalidationEpochStore()
let storeRegistered = false

export function registerDiaryListCacheStore(): void {
  if (storeRegistered) return
  storeRegistered = true
  globalCacheRegistry.register(DIARY_LIST_CACHE_KEY, {
    invalidate: () => diaryListEpoch.invalidate(),
    clear: () => diaryListEpoch.clear()
  })
}

export function subscribeDiaryListCache(listener: () => void): () => void {
  registerDiaryListCacheStore()
  return diaryListEpoch.subscribe(listener)
}

export function getDiaryListCacheVersion(): number {
  registerDiaryListCacheStore()
  return diaryListEpoch.getVersion()
}
