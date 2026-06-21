import { describe, it, expect } from 'vitest'
import { registerDiaryListCacheStore, getDiaryListCacheVersion, subscribeDiaryListCache } from '../diary-list-cache'
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
})
