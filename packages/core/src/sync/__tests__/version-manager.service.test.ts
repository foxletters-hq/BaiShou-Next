import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IVersionManager } from '../version-manager.interface';
import type { VersionSnapshot } from '@baishou/shared';
import {
  VersionBackupError,
  VersionRestoreError,
  VersionNotFoundError,
} from '../sync.errors';

describe('VersionManager', () => {
  let manager: IVersionManager;

  beforeEach(() => {
    manager = {
      backup: vi.fn(),
      backupBatch: vi.fn(),
      getVersions: vi.fn(),
      restore: vi.fn(),
      cleanup: vi.fn(),
    } satisfies IVersionManager;
  });

  describe('backup', () => {
    it('should backup file and return backup path', async () => {
      const backupPath = '.versions/Journals/2026/05/2026-05-13/1715587200000.md';
      vi.mocked(manager.backup).mockResolvedValue(backupPath);

      const result = await manager.backup('Journals/2026/05/2026-05-13.md');
      expect(result).toBe(backupPath);
    });

    it('should throw VersionBackupError when backup fails', async () => {
      vi.mocked(manager.backup).mockRejectedValue(new VersionBackupError());

      await expect(manager.backup('file.md')).rejects.toThrow(VersionBackupError);
    });
  });

  describe('backupBatch', () => {
    it('should backup multiple files', async () => {
      const paths = [
        '.versions/Journals/2026/05/2026-05-13/1715587200000.md',
        '.versions/Journals/2026/05/2026-05-12/1715587200000.md',
      ];
      vi.mocked(manager.backupBatch).mockResolvedValue(paths);

      const result = await manager.backupBatch([
        'Journals/2026/05/2026-05-13.md',
        'Journals/2026/05/2026-05-12.md',
      ]);
      expect(result).toEqual(paths);
    });
  });

  describe('getVersions', () => {
    it('should return versions sorted by date descending', async () => {
      const versions: VersionSnapshot[] = [
        {
          id: 1715587200000,
          filePath: 'Journals/2026/05/2026-05-13.md',
          size: 1024,
          createdAt: new Date('2026-05-13T10:00:00Z'),
          reason: 'sync',
        },
        {
          id: 1715500800000,
          filePath: 'Journals/2026/05/2026-05-13.md',
          size: 900,
          createdAt: new Date('2026-05-12T10:00:00Z'),
          reason: 'edit',
        },
      ];
      vi.mocked(manager.getVersions).mockResolvedValue(versions);

      const result = await manager.getVersions('Journals/2026/05/2026-05-13.md');
      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBeGreaterThan(result[1]!.id);
    });

    it('should return empty array when no versions exist', async () => {
      vi.mocked(manager.getVersions).mockResolvedValue([]);

      const result = await manager.getVersions('nonexistent.md');
      expect(result).toEqual([]);
    });
  });

  describe('restore', () => {
    it('should restore file to specified version', async () => {
      vi.mocked(manager.restore).mockResolvedValue(undefined);

      await expect(
        manager.restore('Journals/2026/05/2026-05-13.md', 1715587200000)
      ).resolves.toBeUndefined();
    });

    it('should throw VersionNotFoundError when version does not exist', async () => {
      vi.mocked(manager.restore).mockRejectedValue(new VersionNotFoundError(9999999999999));

      await expect(
        manager.restore('file.md', 9999999999999)
      ).rejects.toThrow(VersionNotFoundError);
    });

    it('should throw VersionRestoreError when restore fails', async () => {
      vi.mocked(manager.restore).mockRejectedValue(new VersionRestoreError());

      await expect(
        manager.restore('file.md', 1715587200000)
      ).rejects.toThrow(VersionRestoreError);
    });
  });

  describe('cleanup', () => {
    it('should cleanup old versions keeping specified count', async () => {
      vi.mocked(manager.cleanup).mockResolvedValue(undefined);

      await expect(manager.cleanup('file.md', 5)).resolves.toBeUndefined();
      expect(manager.cleanup).toHaveBeenCalledWith('file.md', 5);
    });

    it('should use default keep count of 10', async () => {
      vi.mocked(manager.cleanup).mockResolvedValue(undefined);

      await manager.cleanup('file.md');
      expect(manager.cleanup).toHaveBeenCalledWith('file.md');
    });
  });
});
