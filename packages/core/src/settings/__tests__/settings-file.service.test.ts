import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import { SettingsFileService } from '../settings-file.service';
import { IStoragePathService } from '../../vault/storage-path.types';

const { mockWriteFile, mockRename, mockReadFile } = vi.hoisted(() => ({
  mockWriteFile: vi.fn(),
  mockRename: vi.fn(),
  mockReadFile: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    writeFile: (...args: any[]) => mockWriteFile(...args),
    rename: (...args: any[]) => mockRename(...args),
    readFile: (...args: any[]) => mockReadFile(...args),
  },
}));

function settingsPath(sysDir: string) {
  return path.join(sysDir, 'settings.json');
}

function tmpPath(sysDir: string) {
  return path.join(sysDir, 'settings.json.tmp');
}

describe('SettingsFileService', () => {
  let service: SettingsFileService;
  const sysDir = '/vault/.baishou';

  beforeEach(() => {
    mockWriteFile.mockReset();
    mockRename.mockReset();
    mockReadFile.mockReset();
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);

    const mockPathProvider: IStoragePathService = {
      getVaultSystemDirectory: vi.fn().mockResolvedValue(sysDir),
    };

    service = new SettingsFileService(mockPathProvider);
  });

  describe('writeAllSettings', () => {
    it('should write to tmp file then rename atomically', async () => {
      const settings = { theme: 'dark', language: 'zh' };

      await service.writeAllSettings(settings);

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      expect(mockWriteFile).toHaveBeenCalledWith(
        tmpPath(sysDir),
        JSON.stringify(settings, null, 2),
        'utf8',
      );

      expect(mockRename).toHaveBeenCalledTimes(1);
      expect(mockRename).toHaveBeenCalledWith(
        tmpPath(sysDir),
        settingsPath(sysDir),
      );
    });

    it('should serialize concurrent writes via write lock', async () => {
      const settings1 = { key: 'first' };
      const settings2 = { key: 'second' };

      let resolveFirst: () => void;
      let resolveRename: () => void;
      const firstWritePromise = new Promise<void>((r) => { resolveFirst = r; });
      const firstRenamePromise = new Promise<void>((r) => { resolveRename = r; });
      mockWriteFile.mockReturnValueOnce(firstWritePromise);
      mockRename.mockReturnValueOnce(firstRenamePromise);

      const p1 = service.writeAllSettings(settings1);
      // 让微任务队列清空，确保第一次写入已开始
      await new Promise((r) => setTimeout(r, 0));
      const p2 = service.writeAllSettings(settings2);

      // 第二次写入不应该开始（writeFile 还未被第二次调用），因为第一次还在进行中
      expect(mockWriteFile).toHaveBeenCalledTimes(1);

      resolveFirst!();
      resolveRename!();
      await p1;
      await p2;

      expect(mockWriteFile).toHaveBeenCalledTimes(2);
      expect(mockRename).toHaveBeenCalledTimes(2);
    });
  });

  describe('readAllSettings', () => {
    it('should return parsed settings when file is valid', async () => {
      const settings = { theme: 'light', fontSize: 14 };
      mockReadFile.mockResolvedValue(JSON.stringify(settings));

      const result = await service.readAllSettings();

      expect(result).toEqual(settings);
    });

    it('should return empty object when file is empty', async () => {
      mockReadFile.mockResolvedValue('');

      const result = await service.readAllSettings();

      expect(result).toEqual({});
    });

    it('should return empty object when file does not exist', async () => {
      const err = new Error('ENOENT') as any;
      err.code = 'ENOENT';
      mockReadFile.mockRejectedValue(err);

      const result = await service.readAllSettings();

      expect(result).toEqual({});
    });

    it('should attempt recovery when JSON is corrupted with trailing garbage', async () => {
      const validPart = { theme: 'dark', lang: 'zh' };
      const corrupted = JSON.stringify(validPart) + '\n"S"\n  }\n}';
      mockReadFile.mockResolvedValue(corrupted);

      const result = await service.readAllSettings();

      expect(result).toEqual(validPart);
      // 确认自动重写了修复后的内容
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
    });

    it('should return empty object when JSON is completely unrecoverable', async () => {
      mockReadFile.mockResolvedValue('{ this is not json at all [');

      const result = await service.readAllSettings();

      expect(result).toEqual({});
      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });
});
