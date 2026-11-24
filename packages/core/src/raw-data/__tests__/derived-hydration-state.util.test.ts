import { describe, expect, it, vi } from 'vitest'
import type { ISqlExecutor } from '@baishou/shared'
import {
  DERIVED_HYDRATION_STATE_KEY,
  hasVaultBackfillCompleted,
  loadDerivedHydrationState,
  markVaultBackfillCompleted,
  saveDerivedHydrationState
} from '../derived-hydration-state.util'
import { SETTINGS_SYNC_EXCLUDED_KEYS } from '../../settings/settings-domain.util'

describe('derived-hydration-state.util', () => {
  it('excludes derived hydration state key from vault settings disk sync', () => {
    expect(SETTINGS_SYNC_EXCLUDED_KEYS.has(DERIVED_HYDRATION_STATE_KEY)).toBe(true)
  })

  it('persists and reloads vault backfill and legacy copy flags', async () => {
    const store = new Map<string, string>()
    const sqlExecutor: ISqlExecutor = {
      execute: vi.fn(async (query) => {
        const sql = typeof query === 'string' ? query : query.sql
        const args = typeof query === 'string' ? [] : (query.args ?? [])
        if (sql.includes('SELECT value')) {
          const val = store.get(String(args[0]))
          return { rows: val !== undefined ? [{ value: val }] : [] }
        }
        if (sql.includes('INSERT INTO system_settings')) {
          store.set(String(args[0]), String(args[1]))
          return { rows: [], rowsAffected: 1 }
        }
        return { rows: [] }
      })
    }

    const empty = await loadDerivedHydrationState(sqlExecutor)
    expect(empty).toEqual({ backfilledVaultIds: [], legacyManualCopyDone: false })
    expect(hasVaultBackfillCompleted(empty, 'vlt_a')).toBe(false)

    const updated = {
      ...markVaultBackfillCompleted(markVaultBackfillCompleted(empty, 'vlt_a'), 'vlt_a'),
      legacyManualCopyDone: true
    }
    await saveDerivedHydrationState(sqlExecutor, updated)

    const reloaded = await loadDerivedHydrationState(sqlExecutor)
    expect(reloaded).toEqual({ backfilledVaultIds: ['vlt_a'], legacyManualCopyDone: true })
    expect(hasVaultBackfillCompleted(reloaded, 'vlt_a')).toBe(true)
    expect(hasVaultBackfillCompleted(reloaded, 'vlt_b')).toBe(false)
  })

  it('returns empty state safely when SQL query or JSON parse fails', async () => {
    const failingExecutor: ISqlExecutor = {
      execute: vi.fn().mockRejectedValue(new Error('no such table: system_settings'))
    }
    await expect(loadDerivedHydrationState(failingExecutor)).resolves.toEqual({
      backfilledVaultIds: [],
      legacyManualCopyDone: false
    })

    const brokenJsonExecutor: ISqlExecutor = {
      execute: vi.fn().mockResolvedValue({ rows: [{ value: '{broken' }] })
    }
    await expect(loadDerivedHydrationState(brokenJsonExecutor)).resolves.toEqual({
      backfilledVaultIds: [],
      legacyManualCopyDone: false
    })
  })
})
