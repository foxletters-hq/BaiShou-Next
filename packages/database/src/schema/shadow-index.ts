import { sqliteTable, integer, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * 日记影子索引主表 — 对齐原版 `journals_index` 表名
 *
 * 存储在 per-vault 的 `shadow_index.db` 中，由 ShadowIndexConnectionManager 管理。
 * Drizzle schema 仅用于类型推导，不参与 Agent DB 的 migration 流程。
 */
export const shadowJournalIndexTable = sqliteTable(
  'journals_index',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** 相对于 Vault 根目录的文件路径（用于唯一定位 .md 文件） */
    filePath: text('file_path').notNull(),
    /** 日期 ISO8601 字符串 (yyyy-MM-ddTHH:mm:ss.sssZ) */
    date: text('date').notNull(),
    /** 创建时间 ISO8601 */
    createdAt: text('created_at').notNull(),
    /** 最后修改时间 ISO8601 */
    updatedAt: text('updated_at').notNull(),
    /** MD5 内容指纹（用于脏检测，避免无意义解析） */
    contentHash: text('content_hash').notNull(),
    // ── 可选扩展 Frontmatter 元数据 ──
    weather: text('weather'),
    mood: text('mood'),
    location: text('location'),
    locationDetail: text('location_detail'),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
    hasMedia: integer('has_media', { mode: 'boolean' }).notNull().default(false),
    // ── FTS 辅助字段（在主表冗余存储，方便 FTS 虚拟表触发器同步） ──
    /** 原始 Markdown 正文（不含 Frontmatter） */
    rawContent: text('raw_content'),
    /** 以逗号分隔的标签字符串（eg: "日记,美食,旅行"） */
    tags: text('tags'),
  },
  (t) => ({
    filePathUniq: uniqueIndex('journals_index_file_path_unique').on(t.filePath),
  })
);

/**
 * 日记全文搜索 FTS5 虚拟表 — 对齐原版 `journals_fts` 表名
 *
 * 此表由 ShadowIndexConnectionManager 直接用原生 SQL 创建（FTS5 虚拟表无法由 Drizzle 管理）。
 * 这里仅提供类型定义占位，实际建表在 ShadowIndexConnectionManager 中完成。
 */
export const shadowJournalFtsTable = sqliteTable('journals_fts', {
  rowid: integer('rowid').primaryKey(),
  content: text('content'),
  tags: text('tags'),
});
