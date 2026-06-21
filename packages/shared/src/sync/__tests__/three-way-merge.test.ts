import { describe, it, expect } from 'vitest'
import type { SyncManifest, ManifestEntry } from '../../types/version-control.types'
import { SYNC_MANIFEST_VERSION } from '../../constants/incremental-sync.constants'
import { threeWayMerge } from '../three-way-merge'

const makeEntry = (overrides: Partial<ManifestEntry> = {}): ManifestEntry => ({
  hash: overrides.hash ?? 'abc123',
  size: overrides.size ?? 1024,
  lastModified: overrides.lastModified ?? 1715587200000
})

const makeManifest = (files: Record<string, ManifestEntry> = {}): SyncManifest => ({
  version: SYNC_MANIFEST_VERSION,
  updatedAt: Date.now(),
  deviceId: 'test',
  files
})

describe('threeWayMerge', () => {
  const filePath = 'Journals/2026/05/test.md'

  it('should return upload for new local file (local-only, no ancestor)', () => {
    const local = makeManifest({ [filePath]: makeEntry() })
    const remote = makeManifest({})
    const ancestor = makeManifest({})

    const decisions = threeWayMerge(local, remote, ancestor)
    const decision = decisions.find((d) => d.filePath === filePath)

    expect(decision?.type).toBe('upload')
  })

  it('should return download for new remote file (remote-only, no ancestor)', () => {
    const local = makeManifest({})
    const remote = makeManifest({ [filePath]: makeEntry() })
    const ancestor = makeManifest({})

    const decisions = threeWayMerge(local, remote, ancestor)
    const decision = decisions.find((d) => d.filePath === filePath)

    expect(decision?.type).toBe('download')
  })

  it('should return delete-local when remote deleted (ancestor has it, remote missing)', () => {
    const entry = makeEntry()
    const local = makeManifest({ [filePath]: entry })
    const remote = makeManifest({})
    const ancestor = makeManifest({ [filePath]: entry })

    const decisions = threeWayMerge(local, remote, ancestor)
    const decision = decisions.find((d) => d.filePath === filePath)

    expect(decision?.type).toBe('delete-local')
  })

  it('should return delete-remote when local deleted (ancestor has it, local missing)', () => {
    const entry = makeEntry()
    const local = makeManifest({})
    const remote = makeManifest({ [filePath]: entry })
    const ancestor = makeManifest({ [filePath]: entry })

    const decisions = threeWayMerge(local, remote, ancestor)
    const decision = decisions.find((d) => d.filePath === filePath)

    expect(decision?.type).toBe('delete-remote')
  })

  it('should skip when all three have same hash', () => {
    const entry = makeEntry()
    const local = makeManifest({ [filePath]: entry })
    const remote = makeManifest({ [filePath]: entry })
    const ancestor = makeManifest({ [filePath]: entry })

    const decisions = threeWayMerge(local, remote, ancestor)
    const decision = decisions.find((d) => d.filePath === filePath)

    expect(decision?.type).toBe('skip')
  })

  it('should download when local equals ancestor but remote differs', () => {
    const ancestorEntry = makeEntry({ hash: 'aaa' })
    const remoteEntry = makeEntry({ hash: 'bbb' })
    const local = makeManifest({ [filePath]: ancestorEntry })
    const remote = makeManifest({ [filePath]: remoteEntry })
    const ancestor = makeManifest({ [filePath]: ancestorEntry })

    const decisions = threeWayMerge(local, remote, ancestor)
    const decision = decisions.find((d) => d.filePath === filePath)

    expect(decision?.type).toBe('download')
  })

  it('should upload when remote equals ancestor but local differs', () => {
    const ancestorEntry = makeEntry({ hash: 'aaa' })
    const localEntry = makeEntry({ hash: 'bbb' })
    const local = makeManifest({ [filePath]: localEntry })
    const remote = makeManifest({ [filePath]: ancestorEntry })
    const ancestor = makeManifest({ [filePath]: ancestorEntry })

    const decisions = threeWayMerge(local, remote, ancestor)
    const decision = decisions.find((d) => d.filePath === filePath)

    expect(decision?.type).toBe('upload')
  })

  it('should resolve conflict when all three hashes differ (newer mtime wins)', () => {
    const ancestorEntry = makeEntry({ hash: 'aaa' })
    const localEntry = makeEntry({ hash: 'bbb', lastModified: 2000 })
    const remoteEntry = makeEntry({ hash: 'ccc', lastModified: 1000 })
    const local = makeManifest({ [filePath]: localEntry })
    const remote = makeManifest({ [filePath]: remoteEntry })
    const ancestor = makeManifest({ [filePath]: ancestorEntry })

    const decisions = threeWayMerge(local, remote, ancestor)
    const decision = decisions.find((d) => d.filePath === filePath)

    expect(decision?.type).toBe('conflict-resolved')
    expect(decision?.direction).toBe('upload')
  })

  it('should resolve conflict in favor of remote when remote mtime is newer', () => {
    const ancestorEntry = makeEntry({ hash: 'aaa' })
    const localEntry = makeEntry({ hash: 'bbb', lastModified: 1000 })
    const remoteEntry = makeEntry({ hash: 'ccc', lastModified: 2000 })
    const local = makeManifest({ [filePath]: localEntry })
    const remote = makeManifest({ [filePath]: remoteEntry })
    const ancestor = makeManifest({ [filePath]: ancestorEntry })

    const decisions = threeWayMerge(local, remote, ancestor)
    const decision = decisions.find((d) => d.filePath === filePath)

    expect(decision?.type).toBe('conflict-resolved')
    expect(decision?.direction).toBe('download')
  })

  it('should prefer remote data when both local and remote are new with different content (empty ancestor)', () => {
    const localEntry = makeEntry({ hash: 'local-hash', lastModified: 1000 })
    const remoteEntry = makeEntry({ hash: 'remote-hash', lastModified: 2000 })
    const local = makeManifest({ [filePath]: localEntry })
    const remote = makeManifest({ [filePath]: remoteEntry })
    const ancestor = makeManifest({})

    const decisions = threeWayMerge(local, remote, ancestor)
    const decision = decisions.find((d) => d.filePath === filePath)

    expect(decision?.type).toBe('conflict-resolved')
    expect(decision?.direction).toBe('download')
    expect(decision?.hash).toBe('remote-hash')
  })

  it('should skip when both local and remote have same content (empty ancestor)', () => {
    const entry = makeEntry({ hash: 'same-hash' })
    const local = makeManifest({ [filePath]: entry })
    const remote = makeManifest({ [filePath]: entry })
    const ancestor = makeManifest({})

    const decisions = threeWayMerge(local, remote, ancestor)
    const decision = decisions.find((d) => d.filePath === filePath)

    expect(decision?.type).toBe('skip')
  })

  it('should handle first-sync scenario: local has files, remote empty, ancestor empty', () => {
    const entry = makeEntry({ hash: 'local-only' })
    const local = makeManifest({ [filePath]: entry })
    const remote = makeManifest({})
    const ancestor = makeManifest({})

    const decisions = threeWayMerge(local, remote, ancestor)
    const decision = decisions.find((d) => d.filePath === filePath)

    expect(decision?.type).toBe('upload')
  })

  it('should handle post-upload scenario: local and remote both have file, ancestor empty', () => {
    const localEntry = makeEntry({ hash: 'same-hash', lastModified: 1000 })
    const remoteEntry = makeEntry({ hash: 'same-hash', lastModified: 2000 })
    const local = makeManifest({ [filePath]: localEntry })
    const remote = makeManifest({ [filePath]: remoteEntry })
    const ancestor = makeManifest({})

    const decisions = threeWayMerge(local, remote, ancestor)
    const decision = decisions.find((d) => d.filePath === filePath)

    expect(decision?.type).toBe('skip')
  })

  it('should skip when neither local nor remote nor ancestor has the file', () => {
    const local = makeManifest({})
    const remote = makeManifest({})
    const ancestor = makeManifest({})

    const decisions = threeWayMerge(local, remote, ancestor)
    expect(decisions).toHaveLength(0)
  })

  it('should skip when both local and remote deleted (ancestor has it, both missing)', () => {
    const entry = makeEntry()
    const local = makeManifest({})
    const remote = makeManifest({})
    const ancestor = makeManifest({ [filePath]: entry })

    const decisions = threeWayMerge(local, remote, ancestor)
    const decision = decisions.find((d) => d.filePath === filePath)

    expect(decision?.type).toBe('skip')
  })

  it('should schedule delete-remote for sqlite runtime files present on remote', () => {
    const dbShm = 'baishou_agent.db-shm'
    const entry = makeEntry({ hash: 'shm-hash' })
    const local = makeManifest({})
    const remote = makeManifest({ [dbShm]: entry })
    const ancestor = makeManifest({})

    const decisions = threeWayMerge(local, remote, ancestor)
    const decision = decisions.find((d) => d.filePath === dbShm)

    expect(decision?.type).toBe('delete-remote')
    expect(decisions.find((d) => d.filePath === dbShm && d.type === 'download')).toBeUndefined()
  })

  it('should delete remote chat background files instead of downloading them', () => {
    const bgPath = 'Personal/Attachments/backgrounds/bg_1.jpg'
    const bgEntry = makeEntry({ hash: 'bg-hash', size: 2048 })
    const local = makeManifest({})
    const remote = makeManifest({ [bgPath]: bgEntry })
    const ancestor = makeManifest({})

    const decisions = threeWayMerge(local, remote, ancestor)
    const decision = decisions.find((d) => d.filePath === bgPath)

    expect(decision?.type).toBe('delete-remote')
    expect(decisions.find((d) => d.filePath === bgPath && d.type === 'download')).toBeUndefined()
  })

  it('should delete-local without ancestor when remote manifest is newer than local file', () => {
    const filePath = 'Personal/Attachments/diary/photo.jpg'
    const localEntry = makeEntry({ hash: 'old', lastModified: 1000 })
    const local = makeManifest({ [filePath]: localEntry })
    const remote = makeManifest({ 'Personal/Journals/other.md': makeEntry() })
    remote.updatedAt = 5000
    const ancestor = makeManifest({})

    const decisions = threeWayMerge(local, remote, ancestor)
    const decision = decisions.find((d) => d.filePath === filePath)

    expect(decision?.type).toBe('delete-local')
  })

  it('should upload without ancestor when local file is newer than remote manifest', () => {
    const newPhotoPath = 'Personal/Attachments/diary/new-photo.jpg'
    const localEntry = makeEntry({ hash: 'new', lastModified: 9000 })
    const local = makeManifest({ [newPhotoPath]: localEntry })
    const remote = makeManifest({ 'Personal/Journals/other.md': makeEntry() })
    remote.updatedAt = 5000
    const ancestor = makeManifest({})

    const decisions = threeWayMerge(local, remote, ancestor)
    const decision = decisions.find((d) => d.filePath === newPhotoPath)

    expect(decision?.type).toBe('upload')
  })

  it('should include file hash and size in decision', () => {
    const entry = makeEntry({ hash: 'abc', size: 999 })
    const local = makeManifest({ [filePath]: entry })
    const remote = makeManifest({})
    const ancestor = makeManifest({})

    const decisions = threeWayMerge(local, remote, ancestor)
    const decision = decisions.find((d) => d.filePath === filePath)

    expect(decision?.hash).toBe('abc')
    expect(decision?.size).toBe(999)
  })
})
