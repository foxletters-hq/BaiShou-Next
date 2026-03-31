import { Summary, CreateSummaryInput, UpdateSummaryInput, SummaryType } from '@baishou/shared';
import { SummarySyncService } from './summary-sync.service';
import { SummaryFileService } from '../vault/summary-file.service';
import { SummaryRepository } from '@baishou/database/src/repositories/summary.repository';

export class SummaryManagerService {
  constructor(
     private readonly summaryRepo: SummaryRepository,
     private readonly fileSync: SummaryFileService,
     private readonly summarySync: SummarySyncService
  ) {}

  async save(input: CreateSummaryInput): Promise<Summary> {
    // 1. 写文件 (真相源泉 SSOT 落盘)
    await this.fileSync.writeSummary(input.type, input.startDate, input.content);
    
    // 2. 触发脏检测与单向入库缓存
    await this.summarySync.syncSummaryFile(input.type, input.startDate, input.endDate);
    
    // 3. 从只读的摘要缓存库返回
    const dbRecord = await this.summaryRepo.getByDateRange(input.type, input.startDate, input.endDate);
    if (!dbRecord) {
        throw new Error('SummarySync failed to materialize record in DB');
    }
    return dbRecord;
  }

  async update(_id: number, type: SummaryType, startDate: Date, endDate: Date, update: UpdateSummaryInput): Promise<Summary> {
    // 我们必须保证有 content 更新才能重写。对于其他可能的字段我们暂时忽略或如果它只是基于库的字段也应走全管线
    const existing = await this.summaryRepo.getByDateRange(type, startDate, endDate);
    if (!existing) throw new Error(`Summary not found for ${type}`);

    const newContent = update.content ?? existing.content;

    await this.fileSync.writeSummary(type, startDate, newContent);
    await this.summarySync.syncSummaryFile(type, startDate, endDate);

    const updated = await this.summaryRepo.getByDateRange(type, startDate, endDate);
    return updated!;
  }

  async readDetail(type: SummaryType, startDate: Date, endDate: Date): Promise<Summary | null> {
    // 读取详情时，优先穿透到文件获得最新鲜正本（哪怕它没有被 sync）
    const content = await this.fileSync.readSummary(type, startDate);
    if (!content) return null;

    // 获取缓存记录的 ID 或其他生成属性
    const dbRecord = await this.summaryRepo.getByDateRange(type, startDate, endDate);
    if (dbRecord) {
        return { ...dbRecord, content };
    }
    
    // Fallback，文件存在但 DB 不存在（可能因为没 sync）
    return {
        id: 0,
        type,
        startDate,
        endDate,
        content,
        generatedAt: new Date()
    };
  }

  async list(options?: { start?: Date }): Promise<Summary[]> {
    // 列表为了展现可以直接读 Shadow SQLite 库，获得极速响应
    return this.summaryRepo.getSummaries(options);
  }

  async delete(type: SummaryType, startDate: Date, endDate: Date): Promise<void> {
    await this.fileSync.deleteSummary(type, startDate);
    await this.summarySync.syncSummaryFile(type, startDate, endDate); // 孤立检测将会自动删之
  }
}
