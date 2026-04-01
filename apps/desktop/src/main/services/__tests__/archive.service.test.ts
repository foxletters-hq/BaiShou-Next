import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fsp from 'fs/promises';
import * as fs from 'fs';
import * as path from 'path';

vi.mock('electron', () => ({
  app: { getPath: vi.fn().mockReturnValue('/mock/userData') },
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() }
}));

vi.mock('fs');
vi.mock('fs/promises');

// Mock @baishou/database to prevent better-sqlite3 bindings error
vi.mock('@baishou/database', () => ({
  connectionManager: { disconnect: vi.fn() },
  SettingsRepository: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
  initNodeDatabase: vi.fn(),
}));

// Mock appDb
vi.mock('../db', () => ({
  appDb: {}
}));

import { DesktopArchiveService } from '../archive.service';

describe('DesktopArchiveService', () => {
  let service: DesktopArchiveService;
  let mockPathService: any;
  let mockVaultService: any;

  beforeEach(() => {
    vi.resetAllMocks();
    mockPathService = { getRootDirectory: vi.fn().mockResolvedValue('/mock/root') };
    mockVaultService = { initRegistry: vi.fn().mockResolvedValue(true) };
    service = new DesktopArchiveService(mockPathService, mockVaultService);
  });

  describe('listSnapshots', () => {
    it('should return empty array if directory does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const res = await service.listSnapshots();
      expect(res).toEqual([]);
    });

    it('should return sorted snapshot metadata', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      // Return files, some are zip, some are not
      vi.mocked(fsp.readdir).mockResolvedValue(['snap1.zip', 'snap2.zip', 'other.txt'] as any);
      
      vi.mocked(fsp.stat).mockImplementation(async (filePath) => {
        if (filePath.toString().includes('snap1')) return { mtimeMs: 1000, size: 10 } as any;
        if (filePath.toString().includes('snap2')) return { mtimeMs: 2000, size: 20 } as any;
        return { mtimeMs: 0, size: 0 } as any;
      });

      const res = await service.listSnapshots();
      
      expect(res).toHaveLength(2);
      expect(res[0].filename).toBe('snap2.zip'); // newer first
      expect(res[1].filename).toBe('snap1.zip');
    });
  });

  describe('deleteSnapshot', () => {
    it('should unlink the file if it exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      await service.deleteSnapshot('snap1.zip');
      
      const expectedPath = path.join('/mock/userData', 'snapshots', 'snap1.zip');
      expect(fsp.unlink).toHaveBeenCalledWith(expectedPath);
    });

    it('should not unlink if file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      await service.deleteSnapshot('snap1.zip');
      expect(fsp.unlink).not.toHaveBeenCalled();
    });
  });

  describe('restoreFromSnapshot', () => {
    it('should throw if snapshot not found', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      await expect(service.restoreFromSnapshot('ghost.zip')).rejects.toThrow('Snapshot not found');
    });

    // Mocking the full importFromZip is tricky because of external deps like extract-zip and sqlite.
    // The main test is that it calls importFromZip with false correctly.
    it('should call importFromZip without creating snapshot before', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const spy = vi.spyOn(service, 'importFromZip').mockResolvedValue({ fileCount: -1, profileRestored: true } as any);
      
      const res = await service.restoreFromSnapshot('real.zip');
      const expectedPath = path.join('/mock/userData', 'snapshots', 'real.zip');
      
      expect(spy).toHaveBeenCalledWith(expectedPath, false);
      expect(res.profileRestored).toBe(true);
    });
  });
});
