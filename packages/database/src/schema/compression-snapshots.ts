import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/**
 * 会话压缩快照表 — 像素级对齐原版 `CompressionSnapshots` Drift 表定义
 *
 * 关键修复：
 * - sessionId: TEXT（原版是 UUID 字符串引用，而非 INTEGER）
 * - coveredUpToMessageId: TEXT（原版是消息 UUID 字符串）
 * - tokenCount: nullable（原版使用 integer().nullable()）
 */
export const compressionSnapshotsTable = sqliteTable('compression_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** 所属会话 ID（UUID 字符串，对齐原版 TEXT 外键） */
  sessionId: text('session_id').notNull(),
  /** 本次压缩的摘要内容 */
  summaryText: text('summary_text').notNull(),
  /** 本快照覆盖到哪条消息的 ID（含）— UUID 字符串 */
  coveredUpToMessageId: text('covered_up_to_message_id').notNull(),
  /** 本次压缩覆盖的消息总数（累计）*/
  messageCount: integer('message_count').notNull(),
  /** 摘要本身的 token 数估算（可为 null） */
  tokenCount: integer('token_count'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow()
});
