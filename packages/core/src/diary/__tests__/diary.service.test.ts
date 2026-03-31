import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiaryService } from '../diary.service';
import { FileSyncService } from '../file-sync.service';
import { VaultIndexService } from '../vault-index.service';
import { ShadowIndexSyncService } from '../../shadow-index/shadow-index-sync.service';
import { ShadowIndexRepository } from '@baishou/database';
import { DiaryNotFoundError, DiaryDateConflictError } from '../diary.types';
import { Diary } from '@baishou/shared';

describe('DiaryService - Single Source of Truth architecture', () => {
  let mockShadowRepo: import('vitest').Mocked<ShadowIndexRepository>;
  let mockFileSync: import('vitest').Mocked<FileSyncService>;
  let mockShadowSync: import('vitest').Mocked<ShadowIndexSyncService>;
  let mockVaultIndex: import('vitest').Mocked<VaultIndexService>;
  let service: DiaryService;

  beforeEach(() => {
    mockShadowRepo = {
      mountFTS: vi.fn(),
      upsert: vi.fn(),
      deleteById: vi.fn(),
      findByDatePrefix: vi.fn(),
      getHashByDate: vi.fn(),
      getAllRecords: vi.fn(),
      searchFTS: vi.fn().mockResolvedValue([]),
      findById: vi.fn(),
      findByDate: vi.fn(),
      listAll: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    } as any;

    mockFileSync = {
      writeJournal: vi.fn(),
      readJournal: vi.fn(),
      deleteJournalFile: vi.fn(),
      fullScanVault: vi.fn(),
    };

    mockShadowSync = {
      setSyncEnabled: vi.fn(),
      waitForScan: vi.fn(),
      onSyncEvent: vi.fn(),
      syncJournal: vi.fn(),
      fullScanVault: vi.fn(),
    } as any;

    mockVaultIndex = {
      upsert: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      forceReload: vi.fn(),
      getAll: vi.fn(),
    };

    service = new DiaryService(
      mockShadowRepo,
      mockFileSync,
      mockShadowSync,
      mockVaultIndex
    );
  });

  it('create() should write file then sync to shadow DB', async () => {
    const inputDate = new Date('2026-03-31T00:00:00.000Z');
    const input = { date: inputDate, content: 'Test body', isFavorite: false };

    // 假设物理文件不存在
    mockFileSync.readJournal.mockResolvedValue(null);
    
    // 假设影子同步结果
    const mockSyncResult = {
      isChanged: true,
      meta: {
        id: 42,
        date: inputDate,
        preview: 'Test body',
        tags: [],
        updatedAt: inputDate
      }
    };
    mockShadowSync.syncJournal.mockResolvedValue(mockSyncResult);

    const result = await service.create(input);

    expect(mockFileSync.readJournal).toHaveBeenCalledWith(inputDate);
    // 确保写入物理文件在前
    expect(mockFileSync.writeJournal).toHaveBeenCalledWith(input);
    // 确保触发同步在后
    expect(mockShadowSync.syncJournal).toHaveBeenCalledWith(inputDate);
    // 确保把同步的结果推给内存库
    expect(mockVaultIndex.upsert).toHaveBeenCalledWith(mockSyncResult.meta);

    // 最终业务层返回 ID 会被补上
    expect(result.id).toBe(42);
  });

  it('create() should throw if file already exists', async () => {
    const inputDate = new Date('2026-03-31');
    const input = { date: inputDate, content: 'Test' };

    // 文件已存在
    mockFileSync.readJournal.mockResolvedValue({ id: 1, ...input, createdAt: new Date(), updatedAt: new Date(), isFavorite: false, mediaPaths: [] });

    await expect(service.create(input)).rejects.toThrow(DiaryDateConflictError);
    expect(mockFileSync.writeJournal).not.toHaveBeenCalled();
    expect(mockShadowSync.syncJournal).not.toHaveBeenCalled();
  });

  it('update() should replace file and trigger shadow re-sync', async () => {
    const existingDateIso = '2026-03-30T00:00:00.000Z';
    const existingDate = new Date(existingDateIso);

    mockShadowRepo.findById.mockResolvedValue({
      id: 99,
      date: existingDateIso.split('T')[0],
      filePath: '2026/03/2026-03-30.md',
      contentHash: 'hash',
      createdAt: '',
      updatedAt: '',
      isFavorite: false,
      hasMedia: false,
      weather: null,
      mood: null,
      location: null,
      locationDetail: null,
    });

    const existingDiary: Diary = {
      id: 99,
      date: existingDate,
      content: 'Old',
      isFavorite: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      mediaPaths: []
    };
    mockFileSync.readJournal.mockResolvedValue(existingDiary);
    mockShadowSync.syncJournal.mockResolvedValue({
      isChanged: true,
      meta: { id: 99, date: existingDate, preview: 'New', tags: [], updatedAt: new Date() }
    });

    await service.update(99, { content: 'New' });

    expect(mockFileSync.writeJournal).toHaveBeenCalledWith(expect.objectContaining({
      content: 'New'
    }));
    expect(mockShadowSync.syncJournal).toHaveBeenCalledWith(existingDate);
    expect(mockVaultIndex.upsert).toHaveBeenCalled();
  });

  it('update() with date change should remove old file', async () => {
    const oldDateIso = '2026-03-30T00:00:00.000Z';
    const oldDate = new Date(oldDateIso);
    const newDate = new Date('2026-03-31T00:00:00.000Z');

    mockShadowRepo.findById.mockResolvedValue({
      id: 99,
      date: oldDateIso.split('T')[0],
      filePath: '',
      contentHash: '',
      createdAt: '',
      updatedAt: '',
      isFavorite: false,
      hasMedia: false,
      weather: null, mood: null, location: null, locationDetail: null,
    });
    
    mockFileSync.readJournal.mockImplementation(async (d) => {
      if (d.getTime() === oldDate.getTime()) return { id: 99, date: oldDate, content: 'Old', isFavorite: false, createdAt: new Date(), updatedAt: new Date(), mediaPaths: [] } as Diary;
      return null; // new date is clear
    });
    mockShadowSync.syncJournal.mockResolvedValue({ isChanged: true, meta: { id: 99, date: newDate, preview: 'New', tags: [], updatedAt: new Date() } });

    await service.update(99, { date: newDate, content: 'New' });

    expect(mockFileSync.deleteJournalFile).toHaveBeenCalledWith(oldDate);
    expect(mockShadowSync.syncJournal).toHaveBeenCalledWith(oldDate); // 删旧
    expect(mockShadowSync.syncJournal).toHaveBeenCalledWith(newDate); // 更新新
  });

  it('delete() should delete file and clear index', async () => {
    const existingDateIso = '2026-03-25T00:00:00.000Z';
    mockShadowRepo.findById.mockResolvedValue({
       id: 1, date: existingDateIso.split('T')[0], filePath: '', contentHash: '', createdAt: '', updatedAt: '', isFavorite: false, hasMedia: false, weather: null, mood: null, location: null, locationDetail: null
    });

    await service.delete(1);

    const d = new Date(existingDateIso);
    expect(mockFileSync.deleteJournalFile).toHaveBeenCalledWith(d);
    // 影子同步由于文件没了会执行级联清理
    expect(mockShadowSync.syncJournal).toHaveBeenCalledWith(d);
    expect(mockVaultIndex.remove).toHaveBeenCalledWith(1);
  });
});
