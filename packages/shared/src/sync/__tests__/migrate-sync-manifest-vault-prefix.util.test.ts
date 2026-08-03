import { describe, expect, it } from 'vitest'
import { SYNC_MANIFEST_VERSION } from '../../constants/incremental-sync.constants'
import type { SyncManifest } from '../../types/version-control.types'
import {
  isSyncManifestPathUnderVault,
  migrateSyncManifestVaultPrefix,
  rewriteSyncManifestVaultPath,
  sumVaultFileBytes
} from '../migrate-sync-manifest-vault-prefix.util'

function manifest(files: SyncManifest['files'], removed?: SyncManifest['removed']): SyncManifest {
  return {
    version: SYNC_MANIFEST_VERSION,
    updatedAt: 1,
    deviceId: 'dev',
    files,
    ...(removed ? { removed } : {})
  }
}

describe('migrateSyncManifestVaultPrefix', () => {
  it('rewrites vault path prefix and preserves entry fields', () => {
    const entry = { hash: 'abc', size: 42, lastModified: 99 }
    const input = manifest({
      'Personal/Journals/a.md': entry,
      'Personal/.baishou/vault.json': { hash: 'meta', size: 10, lastModified: 1 },
      'Other/x.md': { hash: 'o', size: 1, lastModified: 2 },
      vault_registry: { hash: 'r', size: 3, lastModified: 3 }
    })

    const {
      manifest: next,
      migratedKeyCount,
      vaultFileBytes
    } = migrateSyncManifestVaultPrefix(input, 'Personal', '工作')

    expect(migratedKeyCount).toBe(2)
    expect(vaultFileBytes).toBe(52)
    expect(next.files['工作/Journals/a.md']).toEqual(entry)
    expect(next.files['工作/.baishou/vault.json']?.hash).toBe('meta')
    expect(next.files['Other/x.md']?.hash).toBe('o')
    expect(next.files['Personal/Journals/a.md']).toBeUndefined()
  })

  it('migrates removed keys without touching unrelated paths', () => {
    const input = manifest(
      { 'Work/a.md': { hash: 'a', size: 5, lastModified: 1 } },
      {
        'Work/gone.md': { hash: 'g', size: 2, removedAt: 1, deviceId: 'd' },
        'Other/gone.md': { hash: 'o', size: 1, removedAt: 1, deviceId: 'd' }
      }
    )
    const { manifest: next, migratedKeyCount } = migrateSyncManifestVaultPrefix(
      input,
      'Work',
      'Office'
    )
    expect(migratedKeyCount).toBe(2)
    expect(next.removed?.['Office/gone.md']?.hash).toBe('g')
    expect(next.removed?.['Other/gone.md']?.hash).toBe('o')
    expect(next.removed?.['Work/gone.md']).toBeUndefined()
  })

  it('does not treat NameX as under Name', () => {
    expect(isSyncManifestPathUnderVault('PersonalX/a.md', 'Personal')).toBe(false)
    expect(rewriteSyncManifestVaultPath('PersonalX/a.md', 'Personal', 'Work')).toBe(
      'PersonalX/a.md'
    )
  })

  it('no-ops when names are equal', () => {
    const input = manifest({ 'A/a.md': { hash: 'h', size: 8, lastModified: 1 } })
    const result = migrateSyncManifestVaultPrefix(input, 'A', 'A')
    expect(result.migratedKeyCount).toBe(0)
    expect(result.vaultFileBytes).toBe(8)
    expect(result.manifest).toBe(input)
  })

  it('sumVaultFileBytes ignores non-matching prefixes', () => {
    expect(
      sumVaultFileBytes(
        {
          'A/a.md': { hash: '1', size: 10, lastModified: 1 },
          'AB/b.md': { hash: '2', size: 100, lastModified: 1 }
        },
        'A'
      )
    ).toBe(10)
  })
})
