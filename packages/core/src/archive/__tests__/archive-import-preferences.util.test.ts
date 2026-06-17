import { describe, expect, it } from 'vitest'
import {
  mergeArchivePrefsPreservingCloudSync,
  shouldPreserveLocalCloudSyncOnImport
} from '../archive-import-preferences.util'

describe('archive-import-preferences.util', () => {
  it('preserves local cloud_sync_config when defined (including null)', () => {
    const prefs = { cloud_sync_config: { target: 's3' }, nickname: 'test' }
    expect(mergeArchivePrefsPreservingCloudSync(prefs, { target: 'local' })).toEqual({
      cloud_sync_config: { target: 'local' },
      nickname: 'test'
    })
    expect(mergeArchivePrefsPreservingCloudSync(prefs, null)).toEqual({
      cloud_sync_config: null,
      nickname: 'test'
    })
  })

  it('keeps backup cloud_sync when local was never read', () => {
    const prefs = { cloud_sync_config: { target: 's3' } }
    expect(mergeArchivePrefsPreservingCloudSync(prefs, undefined)).toEqual(prefs)
    expect(shouldPreserveLocalCloudSyncOnImport(undefined)).toBe(false)
    expect(shouldPreserveLocalCloudSyncOnImport(null)).toBe(true)
  })
})
