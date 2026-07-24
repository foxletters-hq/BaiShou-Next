import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

/**
 * 日记 RAG 嵌入欠账表（Agent DB）
 * 成功嵌入后删除行；不保留长期 done 历史。
 */
export const diaryEmbedJobsTable = sqliteTable(
  'diary_embed_jobs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    vaultName: text('vault_name').notNull(),
    diaryId: integer('diary_id').notNull(),
    contentHash: text('content_hash').notNull(),
    /** pending | running | failed */
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    nextRetryAt: integer('next_retry_at'),
    updatedAt: integer('updated_at').notNull(),
    createdAt: integer('created_at').notNull()
  },
  (t) => ({
    vaultDiaryUniq: uniqueIndex('diary_embed_jobs_vault_diary_unique').on(t.vaultName, t.diaryId),
    statusRetryIdx: index('diary_embed_jobs_status_retry_idx').on(t.status, t.nextRetryAt)
  })
)

export type DiaryEmbedJobRow = typeof diaryEmbedJobsTable.$inferSelect
