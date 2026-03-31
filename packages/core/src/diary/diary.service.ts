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
    
    // 2. 物理写入 Markdown 文件 (完全不存在 ID。让它为空)
    await this.fileSync.writeJournal(input);

    // 3. 同步到 SQLite 影子索引中，这将计算 hash，写入 db，并产生唯一 ID
    const syncResult = await this.shadowSync.syncJournal(input.date);
    if (!syncResult.meta) {
        throw new Error("写入文件后却无法建立影子索引");
    }

    // 更新文件上的前缀信息（主要是为了让被自动生成的 ID 固定在新写入的 MD 文件的 YAML frontmatter 里）
    // 第二次写入会触发文件保存，但因为 hash，ShadowSync 一会儿如果再调也不会冲突，或者直接使用内存状态即可。
    const finalDiary: Diary = {
      ...input,
      id: syncResult.meta.id,
      createdAt: syncResult.meta.date,
      updatedAt: syncResult.meta.updatedAt,
      isFavorite: input.isFavorite ?? false,
      mediaPaths: input.mediaPaths ? JSON.parse(input.mediaPaths) : [], // shared 侧假设我们在这里将其展开
    };
    
    // 覆盖写一次以便为裸创的 MD 附加 ID（原版也是这么做的，如果有 ID，下次重建或拉取不会变）。
    await this.fileSync.writeJournal(finalDiary); 

    // 4. 重置/更新界面内存索引以供列表呈现
    this.vaultIndex.upsert(syncResult.meta);

    return finalDiary;
  }

  async update(id: number, input: UpdateDiaryInput): Promise<Diary> {
    // 使用影子索引查询要修改的文件的历史日历
    const existingShadow = await this.shadowRepo.findById(id);
    if (!existingShadow) {
      throw new DiaryNotFoundError(id);
    }
    
    const existingDate = new Date(existingShadow.date + 'T00:00:00.000Z');

    // 尝试拉出物理正本文件
    const existingDiary = await this.fileSync.readJournal(existingDate);
    if (!existingDiary) {
       // 如果由于各种奇怪原因，文件被人删了但索引还存留
       throw new DiaryNotFoundError(id);
    }

    // 检查日期跳转时的覆盖合并
    if (input.date && input.date.getTime() !== existingDate.getTime()) {
      const conflict = await this.fileSync.readJournal(input.date);
      if (conflict) {
        throw new DiaryDateConflictError(input.date);
      }
      
      try {
        await this.fileSync.deleteJournalFile(existingDate);
      } catch (e) {
        console.warn('Failed to delete old file during update', e);
      }
    }

    // 模拟数据落盘（此时文件指纹一定会变动）
    const mergedDiaryToSave: Diary = { ...existingDiary, ...input, id: id, updatedAt: new Date() };
    await this.fileSync.writeJournal(mergedDiaryToSave);

    // 呼唤影子同步引擎进行更新重算和提取
    // 如果修改了日期，那么目标文件名也变了，要对新的日期发出同步令，对旧日期由于删除了它会自动触发孤立清除
    const targetDate = input.date ? input.date : existingDate;
    
    if (input.date && input.date.getTime() !== existingDate.getTime()) {
       await this.shadowSync.syncJournal(existingDate); // 这会触发删除旧索引的孤立清理
    }
    
    const syncResult = await this.shadowSync.syncJournal(targetDate);

    if (syncResult.meta) {
      this.vaultIndex.upsert(syncResult.meta);
    } else {
      // 预防性清理防止鬼影
      this.vaultIndex.remove(id);
    }

    return mergedDiaryToSave;
  }

  async delete(id: number): Promise<void> {
    const existingShadow = await this.shadowRepo.findById(id);
    if (existingShadow) {
      const existingDate = new Date(existingShadow.date + 'T00:00:00.000Z');
      await this.fileSync.deleteJournalFile(existingDate);
      
      // 触发脏检测将会使其判定为孤立索引并级联删除向量、重置一切缓存
      await this.shadowSync.syncJournal(existingDate);
      
      this.vaultIndex.remove(id);
    }
  }

  async findById(id: number): Promise<Diary | null> {
    const shadow = await this.shadowRepo.findById(id);
    if (!shadow) return null;
    const date = new Date(shadow.date + 'T00:00:00.000Z');
    return this.fileSync.readJournal(date);
  }

  async findByDate(date: Date): Promise<Diary | null> {
    // 穿透底层：真相直接来在物理文件
    return this.fileSync.readJournal(date);
  }

  async listAll(options?: { limit?: number; offset?: number }): Promise<DiaryMeta[]> {
    const shadows = await this.shadowRepo.listAll(options);
    return shadows.map((s) => ({
       id: s.id,
       date: new Date(s.date + 'T00:00:00.000Z'),
       preview: "", // 可选，依赖前台显示
       tags: s.weather ? [s.weather] : [], // 这里应由上层通过 search 或内存 VaultIndex 管理，简单降级映射
       updatedAt: new Date(s.updatedAt + 'T00:00:00.000Z'),
    }));
  }

  async search(query: string, options?: { limit?: number; offset?: number }): Promise<any[]> {
    // 直接下探 ShadowIndex 全文快速检索表
    return this.shadowRepo.searchFTS(query, options?.limit);
  }

  async count(): Promise<number> {
    return this.shadowRepo.count();
  }
}
