import { describe, it, expect } from 'vitest'
import {
  registerDiaryListCacheStore,
  getDiaryListCacheVersion,
  subscribeDiaryListCache,
  invalidateDiaryListCache,
  emitDiaryListSavedPatch,
  subscribeDiaryListSavedPatch,
  notifyDiaryListAfterSave
} from '../diary-list-cache'
import { applyCacheInvalidation, globalCacheRegistry } from '../index'
import type { DomainMutationEvent } from '../domain-mutation.types'

describe('diary-list-cache', () => {
  it('bumps version when diary.create invalidates diary.list', () => {
    registerDiaryListCacheStore()
    const start = getDiaryListCacheVersion()

    applyCacheInvalidation(
      {
        domain: 'diary',
        action: 'create',
        timestamp: Date.now()
      } satisfies DomainMutationEvent,
      globalCacheRegistry
    )

    expect(getDiaryListCacheVersion()).toBeGreaterThan(start)
  })

  it('notifies subscribers', () => {
    registerDiaryListCacheStore()
    let notified = false
    const unsub = subscribeDiaryListCache(() => {
      notified = true
    })

    globalCacheRegistry.invalidate(['diary.list'], 'test')
    expect(notified).toBe(true)
    unsub()
  })

  it('invalidateDiaryListCache bumps version directly', () => {
    registerDiaryListCacheStore()
    const start = getDiaryListCacheVersion()
    invalidateDiaryListCache('manual')
    expect(getDiaryListCacheVersion()).toBeGreaterThan(start)
  })

  it('notifyDiaryListAfterSave bumps cache and notifies patch subscribers', () => {
    registerDiaryListCacheStore()
    const start = getDiaryListCacheVersion()
    let received: { id: number; preview: string } | null = null
    const unsub = subscribeDiaryListSavedPatch((patch) => {
      received = patch
    })
    notifyDiaryListAfterSave({ id: 7, preview: 'hello' })
    expect(received).toEqual({ id: 7, preview: 'hello' })
    expect(getDiaryListCacheVersion()).toBeGreaterThan(start)
    unsub()
  })
})
