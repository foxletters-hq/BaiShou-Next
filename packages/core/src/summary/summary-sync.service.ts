import { MissingSummaryDetector } from './missing-summary-detector.service';
import { SummaryGeneratorService } from './summary-generator.service';
import { SummaryRepository } from '@baishou/database/src/repositories/summary.repository';
import { MissingSummary, SummaryType } from '@baishou/shared';
import { SummaryFileService } from '../vault/summary-file.service';

export interface SummarySyncCallbacks {
  onProgress?: (missing: MissingSummary, status: string) => void;
  onCompleted?: () => void;
  onError?: (error: any) => void;
}

export class SummarySyncService {
  private isSyncing = false;

  constructor(
    private readonly detector: MissingSummaryDetector | null,
    private readonly generator: SummaryGeneratorService | null,
    private readonly summaryRepo: SummaryRepository,
    private readonly fileService: SummaryFileService
  ) {}

  /**
   * 自动发现所有遗失的总结并调用 AI 补全。
   * @param callbacks 用于 UI 层反馈当前进度的回调。
   */
  async syncMissingSummaries(callbacks?: SummarySyncCallbacks): Promise<void> {
    if (this.isSyncing || !this.detector || !this.generator) return;
    this.isSyncing = true;

    try {
      const missingList = await this.detector.getAllMissing();
      
      for (const missing of missingList) {
        let finalContent = '';
        
        const stringStream = this.generator.generate(missing);

        for await (const chunk of stringStream) {
          if (chunk.startsWith('STATUS:')) {
            callbacks?.onProgress?.(missing, chunk.replace('STATUS:', ''));
          } else {
            // 在实际的业务中如果 AI 服务返回的是一段段的 token stream，
            // 那么这就是拼接的过程，若是整块，那么只会有一次有效合并。
            finalContent += chunk;
          }
        }

        if (finalContent.trim().length > 0) {
          // 在自动生成后，必须先保存物理文件，才能触发同步！！不能再走后门写库了
          await this.fileService.writeSummary(missing.type, missing.startDate, finalContent);
          await this.syncSummaryFile(missing.type, missing.startDate, missing.endDate);
        }
      }

      callbacks?.onCompleted?.();

    } catch (e: any) {
      callbacks?.onError?.(e);
      console.error('[SummarySyncService] Synchronization stopped due to error', e);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 针对单一文件执行与缓存表 DB 之间的对比与同步（脏检查/孤立清理）。
   */
  async syncSummaryFile(type: SummaryType, startDate: Date, endDate: Date): Promise<void> {
    const fileContent = await this.fileService.readSummary(type, startDate);
    const existingDb = await this.summaryRepo.getByDateRange(type, startDate, endDate);

    if (fileContent == null) {
       // 物理文件已不再，说明它变成了孤立索引（Ghost Index）
       if (existingDb && existingDb.id != null) {
          await this.summaryRepo.delete(existingDb.id);
       }
       return;
    }

    // 存在物理文件，比对数据库是否有记录或记录是否陈旧
    // 如果无记录，或者完全由于外部更改导致 content 不一致，我们执行覆盖 Upsert
    if (!existingDb || existingDb.content !== fileContent) {
       await this.summaryRepo.upsert({
          type,
          startDate,
          endDate,
          content: fileContent
       });
    }
  }

  /**
   * 网盘启动、重建全库或者数据漫游使用的主动补齐。
   */
  async fullScanArchives(): Promise<void> {
    const allFiles = await this.fileService.listAllSummaries();
    
    for (const f of allFiles) {
       await this.syncSummaryFile(f.type, f.startDate, f.endDate);
    }
    
    // 顺向孤立检查（找出 DB 中有但 File 中没有的文件）
    const allDb = await this.summaryRepo.getSummaries();
    for (const record of allDb) {
       const isFileExist = allFiles.some(f => f.type === record.type && f.startDate.getTime() === record.startDate.getTime());
       if (!isFileExist && record.id != null) {
           await this.summaryRepo.delete(record.id);
       }
    }
  }

  isCurrentlySyncing(): boolean {
    return this.isSyncing;
  }
}
