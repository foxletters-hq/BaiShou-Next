import { describe, expect, it } from 'vitest'
import type { SyncManifest } from '../../types/version-control.types'
import { upsertManifestPathEntries } from '../sync-manifest-path-entries.util'

function emptyManifest(files: SyncManifest['files'] = {}): SyncManifest {
  return { version: 1, updatedAt: 1, deviceId: 't', files }
}

describe('upsertManifestPathEntries', () => {
  it('upserts and deletes path entries', () => {
    const base = emptyManifest({
      'a.md': { hash: 'h1', size: 1, lastModified: 1 },
      'b.md': { hash: 'h2', size: 2, lastModified: 2 }
    })
    const next = upsertManifestPathEntries(base, {
      'a.md': { hash: 'h1b', size: 10, lastModified: 3 },
      'b.md': null,
      'c.md': { hash: 'h3', size: 3, lastModified: 4 }
    })
    expect(next.files['a.md']?.hash).toBe('h1b')
    expect(next.files['b.md']).toBeUndefined()
    expect(next.files['c.md']?.hash).toBe('h3')
    expect(next.updatedAt).toBeGreaterThan(base.updatedAt)
  })

  it('returns same normalized manifest when unchanged', () => {
    const entry = { hash: 'h1', size: 1, lastModified: 1 }
    const base = emptyManifest({ 'a.md': entry })
    const next = upsertManifestPathEntries(base, { 'a.md': { ...entry } })
    expect(next.files['a.md']).toEqual(entry)
  })
})
