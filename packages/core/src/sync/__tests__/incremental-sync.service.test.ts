import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IIncrementalSyncService } from '../incremental-sync.interface';
import type { S3SyncConfig, SyncManifest, IncrementalSyncResult } from '@baishou/shared';
import {
  S3NotConfiguredError,
  S3ConnectionError,
  S3SyncError,
} from '../sync.errors';

describe('IncrementalSyncService', () => {
  let service: IIncrementalSyncService;

  beforeEach(() => {
    service = {
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
      testConnection: vi.fn(),
      sync: vi.fn(),
      uploadOnly: vi.fn(),
      downloadOnly: vi.fn(),
      getLocalManifest: vi.fn(),
      getRemoteManifest: vi.fn(),
      refreshLocalManifest: vi.fn(),
      getLastSyncConflicts: vi.fn(),
    } satisfies IIncrementalSyncService;
  });

  describe('getConfig', () => {
    it('should return current S3 config', async () => {
      const config: S3SyncConfig = {
        enabled: true,
        endpoint: 'https://s3.amazonaws.com',
        region: 'us-east-1',
        bucket: 'my-bucket',
        path: 'baishou/',
        accessKey: 'AKIAIOSFODNN7EXAMPLE',
        secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      };
      vi.mocked(service.getConfig).mockResolvedValue(config);

      const result = await service.getConfig();
      expect(result).toEqual(config);
    });
  });

  describe('updateConfig', () => {
    it('should update config with partial values', async () => {
      vi.mocked(service.updateConfig).mockResolvedValue(undefined);

      await expect(service.updateConfig({ bucket: 'new-bucket' })).resolves.toBeUndefined();
      expect(service.updateConfig).toHaveBeenCalledWith({ bucket: 'new-bucket' });
    });
  });

  describe('testConnection', () => {
    it('should return true when connection succeeds', async () => {
      vi.mocked(service.testConnection).mockResolvedValue(true);

      const result = await service.testConnection();
      expect(result).toBe(true);
    });

    it('should return false when connection fails', async () => {
      vi.mocked(service.testConnection).mockResolvedValue(false);

      const result = await service.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('sync', () => {
    it('should perform incremental sync successfully', async () => {
      const result: IncrementalSyncResult = {
        uploaded: ['Journals/2026/05/2026-05-13.md'],
        downloaded: [],
        conflicted: [],
        skipped: ['Journals/2026/05/2026-05-12.md'],
        duration: 1500,
      };
      vi.mocked(service.sync).mockResolvedValue(result);

      const syncResult = await service.sync();
      expect(syncResult).toEqual(result);
    });

    it('should throw S3NotConfiguredError when S3 not configured', async () => {
      vi.mocked(service.sync).mockRejectedValue(new S3NotConfiguredError());

      await expect(service.sync()).rejects.toThrow(S3NotConfiguredError);
    });

    it('should throw S3SyncError when sync fails', async () => {
      vi.mocked(service.sync).mockRejectedValue(new S3SyncError('Upload failed'));

      await expect(service.sync()).rejects.toThrow(S3SyncError);
    });
  });

  describe('uploadOnly', () => {
    it('should only upload changed files', async () => {
      const result: IncrementalSyncResult = {
        uploaded: ['Journals/2026/05/2026-05-13.md'],
        downloaded: [],
        conflicted: [],
        skipped: [],
        duration: 800,
      };
      vi.mocked(service.uploadOnly).mockResolvedValue(result);

      const syncResult = await service.uploadOnly();
      expect(syncResult.uploaded).toHaveLength(1);
      expect(syncResult.downloaded).toHaveLength(0);
    });
  });

  describe('downloadOnly', () => {
    it('should only download changed files', async () => {
      const result: IncrementalSyncResult = {
        uploaded: [],
        downloaded: ['Journals/2026/05/2026-05-13.md'],
        conflicted: [],
        skipped: [],
        duration: 600,
      };
      vi.mocked(service.downloadOnly).mockResolvedValue(result);

      const syncResult = await service.downloadOnly();
      expect(syncResult.downloaded).toHaveLength(1);
      expect(syncResult.uploaded).toHaveLength(0);
    });
  });

  describe('getLocalManifest', () => {
    it('should return local manifest', async () => {
      const manifest: SyncManifest = {
        version: 1,
        updatedAt: Date.now(),
        deviceId: 'device-123',
        files: {
          'Journals/2026/05/2026-05-13.md': {
            hash: 'abc123',
            size: 1024,
            lastModified: Date.now(),
          },
        },
      };
      vi.mocked(service.getLocalManifest).mockResolvedValue(manifest);

      const result = await service.getLocalManifest();
      expect(result).toEqual(manifest);
    });
  });

  describe('getRemoteManifest', () => {
    it('should return remote manifest', async () => {
      const manifest: SyncManifest = {
        version: 1,
        updatedAt: Date.now(),
        deviceId: 'device-456',
        files: {},
      };
      vi.mocked(service.getRemoteManifest).mockResolvedValue(manifest);

      const result = await service.getRemoteManifest();
      expect(result).toEqual(manifest);
    });

    it('should throw S3ConnectionError when fetch fails', async () => {
      vi.mocked(service.getRemoteManifest).mockRejectedValue(new S3ConnectionError());

      await expect(service.getRemoteManifest()).rejects.toThrow(S3ConnectionError);
    });
  });

  describe('getLastSyncConflicts', () => {
    it('should return list of conflicted files', async () => {
      const conflicts = ['Journals/2026/05/2026-05-13.md'];
      vi.mocked(service.getLastSyncConflicts).mockResolvedValue(conflicts);

      const result = await service.getLastSyncConflicts();
      expect(result).toEqual(conflicts);
    });

    it('should return empty array when no conflicts', async () => {
      vi.mocked(service.getLastSyncConflicts).mockResolvedValue([]);

      const result = await service.getLastSyncConflicts();
      expect(result).toEqual([]);
    });
  });
});
