import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SummarySyncService } from '../summary-sync.service';
import { SummaryFileService } from '../../vault/summary-file.service';
import { SummaryRepository } from '@baishou/database/src/repositories/summary.repository';
import { SummaryType } from '@baishou/shared';
import { MissingSummaryDetector } from '../missing-summary-detector.service';
import { SummaryGeneratorService } from '../summary-generator.service';

describe('SummarySyncService (Ghost indexing)', () => {
  let mockFileService: import('vitest').Mocked<SummaryFileService>;
  let mockRepo: import('vitest').Mocked<SummaryRepository>;
  let mockDetector: import('vitest').Mocked<MissingSummaryDetector>;
  let mockGenerator: import('vitest').Mocked<SummaryGeneratorService>;
  let service: SummarySyncService;

  beforeEach(() => {
    mockFileService = {
      readSummary: vi.fn(),
      listAllSummaries: vi.fn(),
    } as any;

    mockRepo = {
      getByDateRange: vi.fn(),
      getSummaries: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    } as any;

    mockDetector = {
        getAllMissing: vi.fn(),
    } as any;

    mockGenerator = {
        generate: vi.fn(),
    } as any;

    service = new SummarySyncService(mockDetector, mockGenerator, mockRepo, mockFileService);
  });

  const type = SummaryType.monthly;
  const start = new Date();
  const end = new Date();

  it('syncSummaryFile() should delete if file goes missing (Ghost cleanup)', async () => {
     // DB 有，文件无
     mockFileService.readSummary.mockResolvedValue(null);
     mockRepo.getByDateRange.mockResolvedValue({ id: 88, content: 'old' } as any);

     await service.syncSummaryFile(type, start, end);

     expect(mockRepo.delete).toHaveBeenCalledWith(88);
     expect(mockRepo.upsert).not.toHaveBeenCalled();
  });

  it('syncSummaryFile() should upsert if DB is empty or outdated', async () => {
     mockFileService.readSummary.mockResolvedValue('Fresh New File');
     
     // 情景 1：DB 为空
     mockRepo.getByDateRange.mockResolvedValueOnce(null);
     await service.syncSummaryFile(type, start, end);
     expect(mockRepo.upsert).toHaveBeenCalledWith(expect.objectContaining({ content: 'Fresh New File' }));

     // 情景 2：DB 不为空但内容过期
     mockRepo.getByDateRange.mockResolvedValueOnce({ id: 1, content: 'Stale DB' } as any);
     await service.syncSummaryFile(type, start, end);
     expect(mockRepo.upsert).toHaveBeenCalledTimes(2); // this one and previous one
  });

  it('fullScanArchives() should prune DB ghosts and upsert existing files', async () => {
     const t2 = new Date();
     mockFileService.listAllSummaries.mockResolvedValue([
         { type: SummaryType.monthly, startDate: start, endDate: end, fullPath: '/a.md' }
     ]);

     // DB 中有个多余的 (比如外部删除了它的文件)
     mockRepo.getSummaries.mockResolvedValue([
         { id: 99, type: SummaryType.monthly, startDate: t2, content: '' } as any
     ]);

     // 用于 syncSummaryFile 能够 mock 正确的流程
     mockFileService.readSummary.mockResolvedValue('content_xyz');
     mockRepo.getByDateRange.mockResolvedValue(null); 

     await service.fullScanArchives();

     // 必定触发删除不存在的文件
     expect(mockRepo.delete).toHaveBeenCalledWith(99);
     
     // 触发新文件的挂载
     expect(mockRepo.upsert).toHaveBeenCalledWith(expect.objectContaining({ content: 'content_xyz' }));
  });
});
