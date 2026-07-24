import { DiaryMeta } from '@baishou/shared'

/**
 * 日记同步结果。
 * 对标原版 `JournalSyncResult`
 */
export interface JournalSyncResult {
  /** 变动后的最新元数据快照 (如果是删除则为 null) */
  meta: DiaryMeta | null
  /** 是否真正发生了变动 (内容更新或删除) */
  isChanged: boolean
}

/**
 * 同步事件载体 (广播给 Repository / VaultIndex 等消费者)
 */
export interface JournalSyncEvent {
  filePath: string
  result: JournalSyncResult
}

/**
 * RAG 嵌入回调接口
 *
 * 影子索引本身不直接依赖 AI 包，而是通过此回调将嵌入责任上移。
 * 这解决了 `@baishou/core` 与 `@baishou/ai` 的循环依赖问题。
 */
export interface IEmbeddingCallback {
  /**
   * @returns `true` 嵌入成功；`false` 已跳过或失败（失败时宿主应已入账）
   */
  reEmbedDiary(params: {
    diaryId: number
    content: string
    tags: string[]
    date: string
    updatedAt: Date
    /** 缺省则使用当前活跃 Vault */
    vaultName?: string
  }): Promise<boolean | void>

  deleteEmbeddingsBySource(sourceType: string, sourceId: string): Promise<void>

  /**
   * 冷启动 skipRag / 即时嵌入失败时写入欠账，供联网后消费。
   * 可选：宿主未实现则忽略。
   */
  enqueueDiaryEmbed?(params: {
    diaryId: number
    contentHash: string
    date: string
    vaultName?: string
  }): void | Promise<void>
}

/**
 * Markdown Frontmatter 解析后的日记结构体
 */
export interface ParsedJournal {
  id: number
  date: string
  content: string
  tags: string[]
  tagColors: Record<string, number>
  createdAt: Date
  updatedAt: Date
  weather?: string
  mood?: string
  location?: string
  locationDetail?: string
  isFavorite: boolean
  mediaPaths: string[]
}
