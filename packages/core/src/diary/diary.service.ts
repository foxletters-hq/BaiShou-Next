import { FileSyncService } from './file-sync.service';
import { VaultIndexService } from './vault-index.service';
import { ShadowIndexSyncService } from '../shadow-index/shadow-index-sync.service';
import { ShadowIndexRepository } from '@baishou/database';
import { CreateDiaryInput, UpdateDiaryInput, Diary, DiaryMeta } from '@baishou/shared';
import { DiaryNotFoundError, DiaryDateConflictError } from './diary.types';

/**
 * 彻底脱离双写架构（Anti-pattern）的正统白守日记统筹层：
 * 日记核心业务服务，组合 Repository 与文件同步以及索引系统的功能。
 * 
 * 真正的唯一真相来源（SSOT）只有物理 Markdown 文件体系。
 * 数据库（Shadow Repo）在此仅提供高速查询与全文 FTS 搜索的『影子快照』。
 */
export class DiaryService {
  constructor(
    private readonly shadowRepo: ShadowIndexRepository,
    private readonly fileSync: FileSyncService,
    private readonly shadowSync: ShadowIndexSyncService,
    private readonly vaultIndex: VaultIndexService,
  ) {}

  async create(input: CreateDiaryInput): Promise<Diary> {
    // 1. 检查物理文件是否存在：以文件系统为唯一真理
    const existingFile = await this.fileSync.readJournal(input.date);
    if (existingFile) {
      throw new DiaryDateConflictError(input.date);
    }
    
    // 2. 补全必要的主键和时间戳（对标原版：targetId = id ?? DateTime.now().millisecondsSinceEpoch）
    // 完全摒弃依赖数据库下发 ID 导致的「双写（覆盖写）」问题。
    const now = new Date();
    const finalDiary: Diary = {
      ...input,
      id: (input as any).id ?? Date.now(),
      createdAt: (input as any).createdAt ?? now,
      updatedAt: now,
      isFavorite: input.isFavorite ?? false,
      mediaPaths: input.mediaPaths ? (typeof input.mediaPaths === 'string' ? JSON.parse(input.mediaPaths) : input.mediaPaths) : [],
    };

    // 3. 执行单次物理落盘
    await this.fileSync.writeJournal(finalDiary);

    // 4. 同步到 SQLite 影子索引中重建缓存并下发向量任务
    const syncResult = await this.shadowSync.syncJournal(input.date);
    if (!syncResult.meta) {
        throw new Error("写入文件后却无法建立影子索引");
    }

    // 5. 更新界面内存索引以供列表呈现
    this.vaultIndex.upsert(syncResult.meta);

    // 确保返回给前端的 ID 始终与数据库实际插入/更新的行 ID 保持强一致（防止脏数据与自增偏离）
    finalDiary.id = syncResult.meta.id;

    return finalDiary;
  }

  // 辅助函数，对齐原版的 fmt.format(date)
  private formatDateString(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  async update(id: number, input: UpdateDiaryInput): Promise<Diary> {
    // 使用影子索引查询要修改的文件的历史日历
    const existingShadow = await this.shadowRepo.findById(id);
    if (!existingShadow) {
      throw new DiaryNotFoundError(id);
    }
    
    const sdStr = String(existingShadow.date);
    const existingDate = sdStr.includes('T') ? new Date(sdStr) : new Date(sdStr + 'T00:00:00.000Z');

    // 尝试拉出物理正本文件
    const existingDiary = await this.fileSync.readJournal(existingDate);
    if (!existingDiary) {
       // 如果由于各种奇怪原因，文件被人删了但索引还存留
       throw new DiaryNotFoundError(id);
    }

    // 确保 input.date 是 Date 对象（前端 IPC 传递可能会变成 string）
    const inputDate = input.date ? (input.date instanceof Date ? input.date : new Date(input.date as any)) : undefined;

    // 比对日期字符串（对标原版 oldDateStr != fmt.format(date)）避免跨时区毫秒比较的 BUG
    const existingDateStr = this.formatDateString(existingDate);
    const inputDateStr = inputDate ? this.formatDateString(inputDate) : existingDateStr;
    const isDateJumped = inputDateStr !== existingDateStr;

    // 检查日期跳转时的覆盖合并
    if (inputDate && isDateJumped) {
      const conflict = await this.fileSync.readJournal(inputDate);
      if (conflict) {
        throw new DiaryDateConflictError(inputDate);
      }
      
      try {
        await this.fileSync.deleteJournalFile(existingDate);
      } catch (e) {
        console.warn('Failed to delete old file during update', e);
      }
    }

    // 模拟数据落盘（此时文件指纹一定会变动）
    const mergedDiaryToSave: Diary = { ...existingDiary, ...input, id: id, updatedAt: new Date() };
    if (inputDate) mergedDiaryToSave.date = inputDate;
    await this.fileSync.writeJournal(mergedDiaryToSave);

    // 呼唤影子同步引擎进行更新重算和提取
    // 如果修改了日期，那么目标文件名也变了，要对新的日期发出同步令，对旧日期由于删除了它会自动触发孤立清除
    const targetDate = inputDate ? inputDate : existingDate;
    
    if (inputDate && isDateJumped) {
       await this.shadowSync.syncJournal(existingDate); // 这会触发删除旧索引的孤立清理
       this.vaultIndex.remove(id); // 安全清理防鬼影
    }
    
    const syncResult = await this.shadowSync.syncJournal(targetDate);

    if (syncResult.meta) {
      this.vaultIndex.upsert(syncResult.meta);
      // 同步最新真实 rowId
      mergedDiaryToSave.id = syncResult.meta.id;
    } else {
      // 预防性清理防止鬼影
      this.vaultIndex.remove(id);
    }

    return mergedDiaryToSave;
  }

  async delete(id: number): Promise<void> {
    const existingShadow = await this.shadowRepo.findById(id);
    if (existingShadow) {
      const sdStr = String(existingShadow.date);
      const existingDate = sdStr.includes('T') ? new Date(sdStr) : new Date(sdStr + 'T00:00:00.000Z');
      await this.fileSync.deleteJournalFile(existingDate);
      
      // 触发脏检测将会使其判定为孤立索引并级联删除向量、重置一切缓存
      await this.shadowSync.syncJournal(existingDate);
      
      this.vaultIndex.remove(id);
    }
  }

  async findById(id: number): Promise<Diary | null> {
    const shadow = await this.shadowRepo.findById(id);
    if (!shadow) return null;
    const sdStr = String(shadow.date);
    const date = sdStr.includes('T') ? new Date(sdStr) : new Date(sdStr + 'T00:00:00.000Z');
    return this.fileSync.readJournal(date);
  }

  async findByDate(date: Date): Promise<Diary | null> {
    // 穿透底层：真相直接来在物理文件
    return this.fileSync.readJournal(date);
  }

  async listAll(options?: { limit?: number; offset?: number }): Promise<DiaryMeta[]> {
    const shadows = await this.shadowRepo.listAllWithFTS(options);
    return shadows.map((s) => {
      let parsedTags: string[] = [];
      if (s.tagsStr) {
        parsedTags = s.tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean);
      }
      return {
         id: s.id,
         date: new Date(s.date + 'T00:00:00.000Z'),
         preview: s.rawContent ? s.rawContent.substring(0, 500) : "",
         tags: parsedTags,
         updatedAt: new Date(s.updatedAt + 'T00:00:00.000Z'),
      };
    });
  }

  async search(query: string, options?: { limit?: number; offset?: number }): Promise<any[]> {
    // 直接下探 ShadowIndex 全文快速检索表
    return this.shadowRepo.searchFTS(query, options?.limit);
  }

  async count(): Promise<number> {
    return this.shadowRepo.count();
  }
}
