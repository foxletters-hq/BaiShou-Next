import { DiaryMeta } from '@baishou/shared';

/**
 * 日记同步结果。
 * 对标原版 `JournalSyncResult`
 */
export interface JournalSyncResult {
  /** 变动后的最新元数据快照 (如果是删除则为 null) */
  meta: DiaryMeta | null;
  /** 是否真正发生了变动 (内容更新或删除) */
  isChanged: boolean;
}

/**
 * 同步事件载体 (广播给 Repository / VaultIndex 等消费者)
 */
export interface JournalSyncEvent {
  filePath: string;
  result: JournalSyncResult;
}

/**
 * RAG 嵌入回调接口
 * 
 * 影子索引本身不直接依赖 AI 包，而是通过此回调将嵌入责任上移。
 * 这解决了 `@baishou/core` 与 `@baishou/ai` 的循环依赖问题。
 */
export interface IEmbeddingCallback {
  reEmbedDiary(params: {
    diaryId: number;
    content: string;
    tags: string[];
    date: string;
    updatedAt: Date;
  }): Promise<void>;

  deleteEmbeddingsBySource(sourceType: string, sourceId: string): Promise<void>;
}

/**
 * Markdown Frontmatter 解析后的日记结构体
 */
export interface ParsedJournal {
  id: number;
  date: string;
  content: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  weather?: string;
  mood?: string;
  location?: string;
  locationDetail?: string;
  isFavorite: boolean;
  mediaPaths: string[];
}
