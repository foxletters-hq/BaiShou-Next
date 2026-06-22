import { describe, expect, it } from 'vitest'
import { SYNC_MANIFEST_REMOVED_MAX_ENTRIES } from '../../constants/incremental-sync.constants'
import type { SyncManifest } from '../../types/version-control.types'
import {
  finalizeIncrementalSyncManifest,
  normalizeSyncManifest,
  pruneSyncManifestRemoved,
  recordSyncManifestRemoved
} from '../sync-manifest-removed.util'
import type { MergeDecision } from '../three-way-merge'

const entry = { hash: 'h1', size: 10, lastModified: 100 }

function manifest(files: Record<string, typeof entry>): SyncManifest {
  return {
    version: 1,
    updatedAt: 1,
    deviceId: 'd',
    files,
    removed: {}
  }
}

describe('sync-manifest-removed.util', () => {
  it('recordSyncManifestRemoved overwrites same path', () => {
    let m = manifest({ 'a.md': entry })
    m = recordSyncManifestRemoved(m, 'a.md', entry, 'device-a', 1000)
    m = recordSyncManifestRemoved(m, 'a.md', { ...entry, hash: 'h2' }, 'device-b', 2000)
    expect(Object.keys(m.removed ?? {})).toHaveLength(1)
    expect(m.removed?.['a.md']?.hash).toBe('h2')
    expect(m.removed?.['a.md']?.removedAt).toBe(2000)
  })

  it('pruneSyncManifestRemoved keeps old entries without time-based expiry', () => {
    const now = 1_000_000
    let m = manifest({})
    m = recordSyncManifestRemoved(m, 'old.md', entry, 'd', now - 365 * 24 * 60 * 60 * 1000)
    m = recordSyncManifestRemoved(m, 'new.md', entry, 'd', now - 1000)
    m = pruneSyncManifestRemoved(m)
    expect(m.removed?.['old.md']).toBeDefined()
    expect(m.removed?.['new.md']).toBeDefined()
  })

  it('pruneSyncManifestRemoved caps to max entries keeping newest', () => {
    const now = Date.now()
    const removed: NonNullable<SyncManifest['removed']> = {}
    for (let i = 0; i < SYNC_MANIFEST_REMOVED_MAX_ENTRIES + 50; i++) {
      removed[`file-${i}.md`] = {
        hash: 'h1',
        size: 10,
        removedAt: now - i,
        deviceId: 'd'
      }
    }
    const m = pruneSyncManifestRemoved({ ...manifest({}), removed })
    expect(Object.keys(m.removed ?? {}).length).toBe(SYNC_MANIFEST_REMOVED_MAX_ENTRIES)
    expect(m.removed?.['file-0.md']).toBeDefined()
    expect(m.removed?.['file-49.md']).toBeDefined()
    expect(m.removed?.[`file-${SYNC_MANIFEST_REMOVED_MAX_ENTRIES + 10}.md`]).toBeUndefined()
  })

  it('finalizeIncrementalSyncManifest records delete-remote and clears on upload', () => {
    const scanned = manifest({})
    const baseline = manifest({ 'gone.md': entry })
    const decisions: MergeDecision[] = [
      {
        filePath: 'gone.md',
        type: 'delete-remote',
        hash: entry.hash,
        size: entry.size,
        localEntry: null,
        remoteEntry: entry,
        ancestorEntry: entry
      },
      {
        filePath: 'new.md',
        type: 'upload',
        hash: entry.hash,
        size: entry.size,
        localEntry: entry,
        remoteEntry: null,
        ancestorEntry: null
      }
    ]
    const final = finalizeIncrementalSyncManifest({
      scanned: { ...scanned, files: { 'new.md': entry } },
      baselineRemote: baseline,
      decisions,
      deviceId: 'local-device',
      nowMs: 5000
    })
    expect(final.removed?.['gone.md']).toBeDefined()
    expect(final.removed?.['new.md']).toBeUndefined()
    expect(final.files['new.md']).toBeDefined()
    expect(final.files['gone.md']).toBeUndefined()
  })

  it('normalizeSyncManifest ensures removed object exists', () => {
    const raw = { version: 1, updatedAt: 0, deviceId: '', files: {} } as SyncManifest
    expect(normalizeSyncManifest(raw).removed).toEqual({})
  })
})
