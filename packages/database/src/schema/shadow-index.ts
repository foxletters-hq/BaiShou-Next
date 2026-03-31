import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * 影子索引表 (journals_index)
 *
 * 这是白守"影子索引"架构的核心存储——它不存放原始内容，
 * 而是从物理 Markdown 文件中提取的元数据快照。
 * 其职责是在不打开文件的情况下，快速提供日记列表、筛选、排序等能力。
 *
 * 像素级还原原版 `shadow_index_database.dart` 的表结构。
 */
export const shadowJournalIndexTable = sqliteTable('shadow_journal_index', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /**
   * 物理文件路径 (相对于 Vault 根目录)
   * 例如: "Journals/2026/03/2026-03-31.md"
   */
  filePath: text('file_path').notNull().unique(),
  /** ISO8601 日期字符串，方便 SQLite 按文本排序 */
  date: text('date').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  /** MD5 内容指纹，用于脏检测 */
  contentHash: text('content_hash').notNull(),

  // 日记元数据字段
  weather: text('weather'),
  mood: text('mood'),
  location: text('location'),
  locationDetail: text('location_detail'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  hasMedia: integer('has_media', { mode: 'boolean' }).notNull().default(false),
});

/**
 * 影子索引 FTS5 初始化 SQL
 *
 * FTS5 虚拟表不能通过 Drizzle ORM 声明式定义，
 * 需要在数据库挂载阶段通过原始 SQL 执行。
 *
 * 还原原版的 journals_fts 虚拟表，使用 unicode61 分词器。
 * 带 FTS5 不可用时的纯表回退逻辑（与原版 _onCreate 保持一致）。
 */
export const SHADOW_INDEX_FTS_INIT_SQL = `
-- 影子索引全文搜索表 (Shadow Index FTS)
-- 注意: 使用 IF NOT EXISTS 保证幂等性
CREATE VIRTUAL TABLE IF NOT EXISTS shadow_journal_fts USING fts5(
  content,
  tags,
  tokenize = 'unicode61'
);
`;

/**
 * FTS5 不受支持时的回退 SQL (极少数嵌入式 SQLite 无 FTS5 模块)
 */
export const SHADOW_INDEX_FTS_FALLBACK_SQL = `
CREATE TABLE IF NOT EXISTS shadow_journal_fts (
  rowid INTEGER PRIMARY KEY,
  content TEXT,
  tags TEXT
);
`;
