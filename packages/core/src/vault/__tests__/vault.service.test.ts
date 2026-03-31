import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VaultService } from '../vault.service';
import { IStoragePathService } from '../storage-path.types';
import { VaultActiveDeleteError, VaultNotFoundError } from '../vault.errors';
import { IDatabaseConnectionManager } from '@baishou/database';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

vi.mock('node:fs/promises');

// 辅助 Mock 实现
const mockPathService: IStoragePathService = {
  getGlobalRegistryDirectory: vi.fn().mockResolvedValue('/global'),
  getVaultDirectory: vi.fn().mockImplementation((name) => Promise.resolve(path.join('/root', name))),
  getVaultSystemDirectory: vi.fn().mockImplementation((name) => Promise.resolve(path.join('/root', name, '.baishou'))),
  getRootDirectory: vi.fn().mockResolvedValue('/root'),
};

const mockDbManager: IDatabaseConnectionManager = {
  connect: vi.fn().mockResolvedValue({}),
  disconnect: vi.fn().mockResolvedValue(undefined),
  getDb: vi.fn(),
  isConnected: vi.fn(),
  getCurrentPath: vi.fn(),
  onConnect: vi.fn(),
  onDisconnect: vi.fn(),
};

describe('VaultService', () => {
  let service: VaultService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new VaultService(mockPathService, mockDbManager);
  });

  describe('initRegistry', () => {
    it('should create Personal vault and registry if file does not exist', async () => {
      const err = new Error('ENOENT') as any;
      err.code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(err);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await service.initRegistry();

      const vaults = service.getAllVaults();
      expect(vaults).toHaveLength(1);
      expect(vaults[0]?.name).toBe('Personal');
      expect(vaults[0]?.path).toBe(path.join('/root', 'Personal'));

      // Verify it was written
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should load existing registry and correct paths', async () => {
      const existingRegistry = [
        {
          name: 'Personal',
          path: 'C:\\oldpath\\Personal',
          createdAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString()
        }
      ];
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingRegistry));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await service.initRegistry();

      const vaults = service.getAllVaults();
      expect(vaults).toHaveLength(1);
      expect(vaults[0]?.path).toBe(path.join('/root', 'Personal'));
      // Expect it to auto-save corrected paths
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('switchVault', () => {
    beforeEach(async () => {
      const existingRegistry = [
        {
          name: 'Personal',
          path: '/root/Personal',
          createdAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString()
        }
      ];
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingRegistry));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      await service.initRegistry();
    });

    it('should update lastAccessedAt if vault exists', async () => {
      const oldVaults = service.getAllVaults();
      const oldTime = oldVaults[0]?.lastAccessedAt.getTime() ?? 0;

      // simulate time passing
      await new Promise(r => setTimeout(r, 10));

      await service.switchVault('Personal');

      const activeVault = service.getActiveVault();
      expect(activeVault?.name).toBe('Personal');
      expect(activeVault?.lastAccessedAt.getTime()).toBeGreaterThan(oldTime);
    });

    it('should create new vault if it does not exist', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      // Add a slight delay so "Work" gets a newer timestamp than "Personal"
      await new Promise(r => setTimeout(r, 10));

      await service.switchVault('Work');

      const vaults = service.getAllVaults();
      expect(vaults).toHaveLength(2);
      
      const activeVault = service.getActiveVault();
      expect(activeVault?.name).toBe('Work');
      expect(activeVault?.path).toBe(path.join('/root', 'Work'));
    });
  });

  describe('deleteVault', () => {
    beforeEach(async () => {
      const existingRegistry = [
        {
          name: 'Personal',
          path: '/root/Personal',
          createdAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString()
        },
        {
          name: 'Work',
          path: '/root/Work',
          createdAt: new Date(Date.now() - 1000).toISOString(),
          lastAccessedAt: new Date(Date.now() - 1000).toISOString()
        }
      ];
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingRegistry));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      await service.initRegistry(); // Active is Personal
    });

    it('should throw error if attempting to delete active vault', async () => {
      await expect(service.deleteVault('Personal')).rejects.toThrow(VaultActiveDeleteError);
    });

    it('should throw error if vault does not exist', async () => {
      await expect(service.deleteVault('NonExistent')).rejects.toThrow(VaultNotFoundError);
    });

    it('should delete non-active vault and remove from registry', async () => {
      vi.mocked(fs.rm).mockResolvedValue(undefined);

      await service.deleteVault('Work');

      const vaults = service.getAllVaults();
      expect(vaults).toHaveLength(1);
      expect(vaults[0]?.name).toBe('Personal');
      
      expect(fs.rm).toHaveBeenCalledWith(path.join('/root', 'Work'), { recursive: true, force: true });
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });
});
