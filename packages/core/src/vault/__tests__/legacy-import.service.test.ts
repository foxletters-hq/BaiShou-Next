import { describe, it, expect, vi } from 'vitest';
import { LegacyArchiveImportService, ILegacyDatabaseAdapter, ILegacyFileAdapter } from '../legacy-import.service';
import extract from 'extract-zip';

// Mock everything fs/extract related
vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn(),
    readFile: vi.fn().mockImplementation((pathStr) => {
      if (pathStr.includes('manifest.json')) return Promise.resolve('{"schema_version": 0}');
      if (pathStr.includes('diaries.json')) return Promise.resolve(JSON.stringify([
        { date: '2020-01-01T12:00:00Z', content: 'legacy day 1' },
      ]));
      return Promise.reject(new Error('ENOENT')); // Mock not exists
    }),
    rm: vi.fn()
  }
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(true)
}));

vi.mock('extract-zip', () => ({
  default: vi.fn().mockResolvedValue(undefined)
}));

describe('LegacyArchiveImportService', () => {
  it.skip('should extract legacy diaries and delegate to database/file adapters', async () => {
    const mockDb: ILegacyDatabaseAdapter = {
      clearAllAgentData: vi.fn(),
      insertLegacySummaries: vi.fn(),
      insertLegacyAgentData: vi.fn()
    };

    const mockFile: ILegacyFileAdapter = {
      writeLegacyDiary: vi.fn(),
      copyLegacyAttachments: vi.fn()
    };

    const service = new LegacyArchiveImportService(mockDb, mockFile);

    const result = await service.importLegacyZip('/dummy/path/backup.zip');

    // 确定正确驱动了解压
    expect(extract).toHaveBeenCalledWith('/dummy/path/backup.zip', expect.anything());
    
    // 确定成功提取了旧版日记 1 条，并没有崩溃
    expect(result.filesCount).toBe(1);
    expect(mockDb.clearAllAgentData).toHaveBeenCalled();
    expect(mockFile.writeLegacyDiary).toHaveBeenCalled();
  });
});
