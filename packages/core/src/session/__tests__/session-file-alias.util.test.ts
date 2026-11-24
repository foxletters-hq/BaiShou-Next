import { describe, expect, it, vi } from 'vitest'
import type { ISqlExecutor } from '@baishou/shared'
import {
  SESSION_FILE_ALIASES_KEY,
  areSessionFileAliasMapsEqual,
  extractVaultFromSessionFileAliasKey,
  loadSessionFileAliases,
  saveSessionFileAliases,
  sessionFileAliasKey
} from '../session-file-alias.util'
import { SETTINGS_SYNC_EXCLUDED_KEYS } from '../../settings/settings-domain.util'

describe('session-file-alias.util', () => {
  it('excludes session file aliases cache from vault settings disk sync', () => {
    expect(SETTINGS_SYNC_EXCLUDED_KEYS.has(SESSION_FILE_ALIASES_KEY)).toBe(true)
  })

  it('builds and parses vault-scoped alias keys and compares maps', () => {
    const key = sessionFileAliasKey(' Personal ', 'chat-1 (conflict)')
    expect(key).toBe('Personal::chat-1 (conflict)')
    expect(extractVaultFromSessionFileAliasKey(key)).toBe('Personal')
    expect(extractVaultFromSessionFileAliasKey('::chat-1')).toBe('')

    expect(areSessionFileAliasMapsEqual({ a: '1', b: '2' }, { b: '2', a: '1' })).toBe(true)
    expect(areSessionFileAliasMapsEqual({ a: '1' }, { a: '2' })).toBe(false)
    expect(areSessionFileAliasMapsEqual({ a: '1' }, { a: '1', b: '2' })).toBe(false)
  })

  it('persists and reloads alias map via system_settings and handles errors safely', async () => {
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

    expect(await loadSessionFileAliases(sqlExecutor)).toEqual({})

    await saveSessionFileAliases(sqlExecutor, {
      'Personal::chat-1 (1)': 'chat-1',
      '  ': 'ignored'
    })
    expect(await loadSessionFileAliases(sqlExecutor)).toEqual({
      'Personal::chat-1 (1)': 'chat-1'
    })

    const failingExecutor: ISqlExecutor = {
      execute: vi.fn().mockRejectedValue(new Error('no such table: system_settings'))
    }
    await expect(loadSessionFileAliases(failingExecutor)).resolves.toEqual({})
    await expect(
      saveSessionFileAliases(failingExecutor, { 'Personal::a': 'b' })
    ).resolves.toBeUndefined()
  })
})
