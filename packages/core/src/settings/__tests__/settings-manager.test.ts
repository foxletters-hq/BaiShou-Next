import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsManagerService } from '../settings-manager.service';
import { SettingsRepository } from '@baishou/database/src/repositories/settings.repository';
import { SettingsFileService } from '../settings-file.service';

describe('SettingsManagerService (Global Vault KV SSOT)', () => {
  let mockFileService: import('vitest').Mocked<SettingsFileService>;
  let mockRepo: import('vitest').Mocked<SettingsRepository>;
  let manager: SettingsManagerService;

  beforeEach(() => {
    mockFileService = {
      writeAllSettings: vi.fn(),
      readAllSettings: vi.fn(),
    } as any;

    mockRepo = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      getAll: vi.fn(),
    } as any;

    manager = new SettingsManagerService(mockRepo, mockFileService);
  });

  it('get() delegates read to high-speed SQLite', async () => {
    mockRepo.get.mockResolvedValue('value-a' as any);
    const val = await manager.get('key-a');
    expect(mockRepo.get).toHaveBeenCalledWith('key-a');
    expect(val).toBe('value-a');
  });

  it('set() intercepts write, updates SQLite and flushes full snapshot to JSON', async () => {
    const fullMap = { 'key-1': 'val-1', 'key-a': 'val-a' };
    mockRepo.getAll.mockResolvedValue(fullMap);

    await manager.set('key-a', 'val-a');

    expect(mockRepo.set).toHaveBeenCalledWith('key-a', 'val-a');
    expect(mockFileService.writeAllSettings).toHaveBeenCalledWith(fullMap);
  });

  it('fullResyncFromDisk() re-populates SQLite with disk map entries', async () => {
    const importedMap = { 'key-x': 'val-x', 'key-y': 'val-y' };
    mockFileService.readAllSettings.mockResolvedValue(importedMap);

    await manager.fullResyncFromDisk();

    expect(mockRepo.set).toHaveBeenCalledWith('key-x', 'val-x');
    expect(mockRepo.set).toHaveBeenCalledWith('key-y', 'val-y');
  });
});
