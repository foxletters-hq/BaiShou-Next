import type { CacheKey } from './cache-keys'
import { globalCacheRegistry } from './cache-registry'
import { createInvalidationEpochStore } from './invalidation-epoch'

const DIARY_LIST_CACHE_KEY = 'diary.list' satisfies CacheKey

const diaryListEpoch = createInvalidationEpochStore()
let storeRegistered = false

/** 保存后即时更新列表卡片（不必等 DB 回读） */
export type DiaryListSavedPatch = {
  id: number
  preview: string
  tags?: string[]
  weather?: string
  mood?: string
  isFavorite?: boolean
  updatedAt?: Date
  tagColors?: Record<string, number>
}

type DiaryListSavedPatchListener = (patch: DiaryListSavedPatch) => void
const savedPatchListeners = new Set<DiaryListSavedPatchListener>()

export function subscribeDiaryListSavedPatch(listener: DiaryListSavedPatchListener): () => void {
  savedPatchListeners.add(listener)
  return () => savedPatchListeners.delete(listener)
}

export function emitDiaryListSavedPatch(patch: DiaryListSavedPatch): void {
  for (const listener of savedPatchListeners) {
    try {
      listener(patch)
    } catch (e) {
      console.warn('[DiaryListCache] saved patch listener error:', e)
    }
  }
}

/**
 * 日记保存后的唯一列表同步入口：先乐观 patch 卡片，再 bump 缓存版本触发静默重拉。
 * 与滚动位置无关；列表层通过 cache version + stale 标记与 DB 对齐。
 */
export function notifyDiaryListAfterSave(patch: DiaryListSavedPatch): void {
  emitDiaryListSavedPatch(patch)
  invalidateDiaryListCache('diary-saved')
}

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

/** 保存/删除日记后主动 bump 列表缓存版本（不依赖 DomainMutation 总线是否已订阅） */
export function invalidateDiaryListCache(reason?: string): void {
  registerDiaryListCacheStore()
  diaryListEpoch.invalidate(reason)
}
