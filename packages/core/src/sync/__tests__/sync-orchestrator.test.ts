import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IncrementalSyncResult, SyncSessionLog, S3SyncConfig } from '@baishou/shared'
import type { ISyncOrchestrator } from '../sync-orchestrator.interface'
import { S3NotConfiguredError, S3SyncError, SyncInProgressError } from '../sync.errors'

const makeResult = (): IncrementalSyncResult => ({
  uploaded: ['Journals/2026/05/new.md'],
  downloaded: [],
  conflicted: [],
  skipped: ['Journals/2026/05/old.md'],
  deletedRemote: [],
  deletedLocal: [],
  duration: 1200,
  sessionId: 'orch-session-1'
})

describe('SyncOrchestrator', () => {
  let orchestrator: ISyncOrchestrator

  beforeEach(() => {
    orchestrator = {
      sync: vi.fn(),
      uploadOnly: vi.fn(),
      downloadOnly: vi.fn(),
      getSyncHistory: vi.fn(),
      testConnection: vi.fn(),
      getConfig: vi.fn(),
      updateConfig: vi.fn()
    } satisfies ISyncOrchestrator
  })

  describe('sync', () => {
    it('should perform full sync and return result with sessionId', async () => {
      const result = makeResult()
      vi.mocked(orchestrator.sync).mockResolvedValue(result)

      const res = await orchestrator.sync()
      expect(res.sessionId).toBe('orch-session-1')
      expect(res.uploaded).toHaveLength(1)
      expect(res.skipped).toHaveLength(1)
    })

    it('should throw S3NotConfiguredError when S3 not configured', async () => {
      vi.mocked(orchestrator.sync).mockRejectedValue(new S3NotConfiguredError())
      await expect(orchestrator.sync()).rejects.toThrow(S3NotConfiguredError)
    })

    it('should throw SyncInProgressError when another sync is already running', async () => {
      vi.mocked(orchestrator.sync).mockRejectedValue(new SyncInProgressError())
      await expect(orchestrator.sync()).rejects.toThrow(SyncInProgressError)
    })

    it('should throw S3SyncError when sync fails', async () => {
      vi.mocked(orchestrator.sync).mockRejectedValue(new S3SyncError('Network error'))
      await expect(orchestrator.sync()).rejects.toThrow(S3SyncError)
    })
  })

  describe('uploadOnly', () => {
    it('should upload without downloading', async () => {
      const result = makeResult()
      result.downloaded = []
      vi.mocked(orchestrator.uploadOnly).mockResolvedValue(result)

      const res = await orchestrator.uploadOnly()
      expect(res.downloaded).toHaveLength(0)
      expect(res.uploaded.length).toBeGreaterThan(0)
    })
  })

  describe('downloadOnly', () => {
    it('should download without uploading', async () => {
      const result = makeResult()
      result.uploaded = []
      result.downloaded = ['f.md']
      vi.mocked(orchestrator.downloadOnly).mockResolvedValue(result)

      const res = await orchestrator.downloadOnly()
      expect(res.uploaded).toHaveLength(0)
      expect(res.downloaded).toHaveLength(1)
    })
  })

  describe('getSyncHistory', () => {
    it('should return empty array when no history', async () => {
      vi.mocked(orchestrator.getSyncHistory).mockResolvedValue([])
      const history = await orchestrator.getSyncHistory()
      expect(history).toEqual([])
    })

    it('should return logs sorted by date descending', async () => {
      const logs: SyncSessionLog[] = [
        {
          sessionId: 's2',
          deviceId: 'dev',
          direction: 'full-sync',
          startedAt: '2026-05-17T11:00:00.000Z',
          completedAt: '2026-05-17T11:00:01.000Z',
          success: true,
          operations: [],
          summary: {
            uploaded: 0,
            downloaded: 0,
            deletedRemote: 0,
            deletedLocal: 0,
            conflicts: 0,
            skipped: 0
          }
        },
        {
          sessionId: 's1',
          deviceId: 'dev',
          direction: 'full-sync',
          startedAt: '2026-05-17T10:00:00.000Z',
          completedAt: '2026-05-17T10:00:01.000Z',
          success: true,
          operations: [],
          summary: {
            uploaded: 0,
            downloaded: 0,
            deletedRemote: 0,
            deletedLocal: 0,
            conflicts: 0,
            skipped: 0
          }
        }
      ]
      vi.mocked(orchestrator.getSyncHistory).mockResolvedValue(logs)

      const history = await orchestrator.getSyncHistory()
      expect(history).toHaveLength(2)
      expect(history[0]!.sessionId).toBe('s2')
    })
  })

  describe('getConfig / updateConfig', () => {
    it('should get S3 config', async () => {
      const config: S3SyncConfig = {
        enabled: true,
        endpoint: 'https://s3.example.com',
        region: 'us-east-1',
        bucket: 'my-bucket',
        path: '/baishou_backup/sync',
        accessKey: 'AK',
        secretKey: 'SK'
      }
      vi.mocked(orchestrator.getConfig).mockResolvedValue(config)
      expect(await orchestrator.getConfig()).toEqual(config)
    })

    it('should update S3 config partially', async () => {
      vi.mocked(orchestrator.updateConfig).mockResolvedValue(undefined)
      await expect(orchestrator.updateConfig({ bucket: 'new-bucket' })).resolves.toBeUndefined()
    })
  })
})
