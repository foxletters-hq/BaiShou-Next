import { Diary, DiaryMeta } from '@baishou/shared';

/**
 * 负责维护运行时所有日志的摘要记忆索引，
 * 供 UI 侧直接读取，触发变更侦听以刷新页面展示。
 */
export interface VaultIndexService {
  upsert(diary: Diary | DiaryMeta): void;
  remove(id: number): void;
  clear(): void;
  forceReload(): Promise<void>;
  getAll(): DiaryMeta[];
}

export class VaultIndexServiceImpl implements VaultIndexService {
  private metas: DiaryMeta[] = [];

  private toMeta(diary: Diary | DiaryMeta): DiaryMeta {
    if ('preview' in diary) {
      return diary as DiaryMeta;
    }
    const d = diary as Diary;
    const content = d.content || '';
    const tagsArray = typeof d.tags === 'string' ? d.tags.split(',').filter(Boolean).map(t => t.trim()) : [];
    return {
      id: d.id!,  // Assuming id is safely present in DB format at this stage
      date: d.date,
      preview: content.length > 120 ? content.substring(0, 120) : content,
      tags: tagsArray,
    };
  }

  upsert(diary: Diary | DiaryMeta): void {
    const meta = this.toMeta(diary);
    const idx = this.metas.findIndex((m) => m.id === meta.id);
    
    if (idx !== -1) {
      this.metas[idx] = meta;
    } else {
      // 保持 date 降序，如果 date 相同则保持 id 降序
      const insertAt = this.metas.findIndex(
        (m) =>
          m.date.getTime() < meta.date.getTime() ||
          (m.date.getTime() === meta.date.getTime() && m.id < meta.id)
      );
      if (insertAt === -1) {
        this.metas.push(meta);
      } else {
        this.metas.splice(insertAt, 0, meta);
      }
    }
  }

  remove(id: number): void {
    this.metas = this.metas.filter((m) => m.id !== id);
  }

  clear(): void {
    this.metas = [];
  }

  async forceReload(): Promise<void> {
    // 该方法通常需配合外部仓储调用加载并赋值给 this.metas。
    // 具体实现可放置于 UI 的 Store 初始化等位置，由容器接管装配。
  }

  getAll(): DiaryMeta[] {
    return this.metas; // 可以根据实际需要做浅拷贝防御
  }
}

