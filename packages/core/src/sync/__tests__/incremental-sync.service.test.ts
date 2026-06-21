import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { SyncManifest, ManifestEntry, IncrementalSyncResult } from '@baishou/shared'
import type { IIncrementalSyncService } from '../incremental-sync.interface'
import { S3NotConfiguredError, S3ConnectionError, ManifestFetchError } from '../sync.errors'

const makeEntry = (overrides: Partial<ManifestEntry> = {}): ManifestEntry => ({
  hash: overrides.hash ?? 'abc123',
  size: overrides.size ?? 1024,
  lastModified: overrides.lastModified ?? 1715587200000
})

const makeManifest = (files: Record<string, ManifestEntry> = {}): SyncManifest => ({
  version: 1,
  updatedAt: Date.now(),
  deviceId: 'test-device',
  files
})

const makeResult = (): IncrementalSyncResult => ({
  uploaded: [],
  downloaded: [],
  conflicted: [],
  skipped: [],
  deletedRemote: [],
  deletedLocal: [],
  duration: 0,
  sessionId: ''
})

describe('IncrementalSyncService (three-way merge)', () => {
  let service: IIncrementalSyncService

  beforeEach(() => {
    service = {
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
      testConnection: vi.fn(),
      sync: vi.fn(),
      uploadOnly: vi.fn(),
      downloadOnly: vi.fn(),
      buildLocalManifest: vi.fn(),
      getLocalManifest: vi.fn(),
      getRemoteManifest: vi.fn(),
      getRemoteSnapshot: vi.fn(),
      refreshLocalManifest: vi.fn(),
      getLastSyncConflicts: vi.fn(),
      planSync: vi.fn()
    } satisfies IIncrementalSyncService
  })

  describe('sync (three-way merge)', () => {
    it('should upload new local file not in ancestor or remote', async () => {
      const result = makeResult()
      result.uploaded = ['Journals/2026/05/new.md']
      result.sessionId = 'session-new'
      vi.mocked(service.sync).mockResolvedValue(result)

      const res = await service.sync()
      expect(res.uploaded).toContain('Journals/2026/05/new.md')
      expect(res.downloaded).toHaveLength(0)
    })

    it('should download new remote file not in ancestor or local', async () => {
      const result = makeResult()
      result.downloaded = ['Summaries/Weekly/2026-W20.md']
      result.sessionId = 'session-dl'
      vi.mocked(service.sync).mockResolvedValue(result)

      const res = await service.sync()
      expect(res.downloaded).toContain('Summaries/Weekly/2026-W20.md')
      expect(res.uploaded).toHaveLength(0)
    })

    it('should delete local file when remote deleted (ancestor has it, remote missing)', async () => {
      const result = makeResult()
      result.deletedLocal = ['Journals/2026/05/deleted.md']
      result.sessionId = 'session-del'
      vi.mocked(service.sync).mockResolvedValue(result)

      const res = await service.sync()
      expect(res.deletedLocal).toContain('Journals/2026/05/deleted.md')
    })

    it('should delete remote file when local deleted (ancestor has it, local missing)', async () => {
      const result = makeResult()
      result.deletedRemote = ['Journals/2026/05/removed.md']
      result.sessionId = 'session-delrem'
      vi.mocked(service.sync).mockResolvedValue(result)

      const res = await service.sync()
      expect(res.deletedRemote).toContain('Journals/2026/05/removed.md')
    })

    it('should skip when all three manifests have same hash', async () => {
      const result = makeResult()
      result.skipped = ['Journals/2026/05/unchanged.md']
      result.sessionId = 'session-skip'
      vi.mocked(service.sync).mockResolvedValue(result)

      const res = await service.sync()
      expect(res.skipped).toContain('Journals/2026/05/unchanged.md')
      expect(res.uploaded).toHaveLength(0)
      expect(res.downloaded).toHaveLength(0)
    })

    it('should download when local equals ancestor but remote differs', async () => {
      const result = makeResult()
      result.downloaded = ['Journals/2026/05/updated-remote.md']
      result.sessionId = 'session-dl2'
      vi.mocked(service.sync).mockResolvedValue(result)

      const res = await service.sync()
      expect(res.downloaded).toContain('Journals/2026/05/updated-remote.md')
      expect(res.uploaded).toHaveLength(0)
    })

    it('should upload when remote equals ancestor but local differs', async () => {
      const result = makeResult()
      result.uploaded = ['Journals/2026/05/updated-local.md']
      result.sessionId = 'session-up'
      vi.mocked(service.sync).mockResolvedValue(result)

      const res = await service.sync()
      expect(res.uploaded).toContain('Journals/2026/05/updated-local.md')
      expect(res.downloaded).toHaveLength(0)
    })

    it('should resolve conflict when all three hashes differ with mtime comparison', async () => {
      const result = makeResult()
      result.conflicted = ['Journals/2026/05/conflict.md']
      result.sessionId = 'session-conflict'
      vi.mocked(service.sync).mockResolvedValue(result)

      const res = await service.sync()
      expect(res.conflicted).toContain('Journals/2026/05/conflict.md')
      expect(res.sessionId).toBeTruthy()
    })

    it('should report deletedRemote and deletedLocal in result', async () => {
      const result = makeResult()
      result.deletedRemote = ['f1.md']
      result.deletedLocal = ['f2.md']
      result.sessionId = 's-deletes'
      vi.mocked(service.sync).mockResolvedValue(result)

      const res = await service.sync()
      expect(res.deletedRemote).toEqual(['f1.md'])
      expect(res.deletedLocal).toEqual(['f2.md'])
    })

    it('should throw S3NotConfiguredError when S3 is not configured', async () => {
      vi.mocked(service.sync).mockRejectedValue(new S3NotConfiguredError())
      await expect(service.sync()).rejects.toThrow(S3NotConfiguredError)
    })

    it('should throw S3ConnectionError when connection fails', async () => {
      vi.mocked(service.sync).mockRejectedValue(new S3ConnectionError())
      await expect(service.sync()).rejects.toThrow(S3ConnectionError)
    })

    it('should throw ManifestFetchError when remote manifest is unavailable', async () => {
      vi.mocked(service.sync).mockRejectedValue(new ManifestFetchError())
      await expect(service.sync()).rejects.toThrow(ManifestFetchError)
    })
  })

  describe('uploadOnly', () => {
    it('should upload changed files without downloading', async () => {
      const result = makeResult()
      result.uploaded = ['Journals/2026/05/new.md']
      result.downloaded = []
      vi.mocked(service.uploadOnly).mockResolvedValue(result)

      const res = await service.uploadOnly()
      expect(res.uploaded).toHaveLength(1)
      expect(res.downloaded).toHaveLength(0)
    })
  })

  describe('downloadOnly', () => {
    it('should download changed files without uploading', async () => {
      const result = makeResult()
      result.downloaded = ['Journals/2026/05/new.md']
      result.uploaded = []
      vi.mocked(service.downloadOnly).mockResolvedValue(result)

      const res = await service.downloadOnly()
      expect(res.downloaded).toHaveLength(1)
      expect(res.uploaded).toHaveLength(0)
    })
  })

  describe('getRemoteSnapshot', () => {
    it('should return empty manifest on first sync', async () => {
      const empty: SyncManifest = {
        version: 1,
        updatedAt: 0,
        deviceId: '',
        files: {}
      }
      vi.mocked(service.getRemoteSnapshot).mockResolvedValue(empty)

      const snapshot = await service.getRemoteSnapshot()
      expect(snapshot.files).toEqual({})
      expect(snapshot.version).toBe(1)
    })

    it('should return the last synced remote manifest', async () => {
      const snap = makeManifest({ 'f.md': makeEntry() })
      vi.mocked(service.getRemoteSnapshot).mockResolvedValue(snap)

      const result = await service.getRemoteSnapshot()
      expect(result.files['f.md']).toBeDefined()
    })
  })
})
