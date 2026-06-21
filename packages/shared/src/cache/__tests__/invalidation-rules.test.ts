import { describe, it, expect } from 'vitest'
import { resolveInvalidatedCacheKeys } from '../invalidation-rules'
import type { DomainMutationEvent } from '../domain-mutation.types'

function event(partial: Omit<DomainMutationEvent, 'timestamp'>): DomainMutationEvent {
  return { ...partial, timestamp: Date.now() }
}

describe('resolveInvalidatedCacheKeys', () => {
  it('invalidates dashboard and diary list on diary.create', () => {
    const keys = resolveInvalidatedCacheKeys(event({ domain: 'diary', action: 'create' }))
    expect(keys).toEqual(['summary.dashboard', 'diary.list'])
  })

  it('invalidates dashboard and gallery on summary.delete', () => {
    const keys = resolveInvalidatedCacheKeys(event({ domain: 'summary', action: 'delete' }))
    expect(keys).toEqual(['summary.dashboard', 'summary.gallery'])
  })

  it('returns all on vault.switch', () => {
    const keys = resolveInvalidatedCacheKeys(
      event({ domain: 'vault', action: 'switch', vaultKey: 'Personal' })
    )
    expect(keys).toBe('all')
  })

  it('invalidates avatars on user profile settings update', () => {
    const keys = resolveInvalidatedCacheKeys(
      event({
        domain: 'settings',
        action: 'update',
        meta: { key: 'user_profile_data' }
      })
    )
    expect(keys).toEqual(['avatar.user', 'avatar.assistant'])
  })

  it('invalidates sync-related caches on sync.complete', () => {
    const keys = resolveInvalidatedCacheKeys(
      event({ domain: 'sync', action: 'complete', reason: 'incremental-sync' })
    )
    expect(keys).toContain('summary.dashboard')
    expect(keys).toContain('avatar.user')
    expect(keys).toContain('mcp.toolContext')
  })
})
