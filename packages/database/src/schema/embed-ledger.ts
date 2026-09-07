import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

/**
 * 本机嵌入账本（Agent DB，与 memory_embeddings 同库）
 * 记录这台设备把哪个来源的哪个版本嵌入过；不参与同步。
 */
export const embedLedgerTable = sqliteTable(
  'embed_ledger',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    vaultId: text('vault_id').notNull(),
    /** diary | memory */
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    contentHash: text('content_hash').notNull().default(''),
    chunkCount: integer('chunk_count').notNull().default(0),
    modelId: text('model_id').notNull().default(''),
    dimension: integer('dimension').notNull().default(0),
    /** embedded | failed */
    status: text('status').notNull().default('embedded'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    embeddedAt: integer('embedded_at'),
    updatedAt: integer('updated_at').notNull()
  },
  (t) => ({
    sourceUniq: uniqueIndex('embed_ledger_source_unique').on(t.vaultId, t.sourceType, t.sourceId),
    readIdx: index('embed_ledger_read_idx').on(
      t.vaultId,
      t.sourceType,
      t.sourceId,
      t.contentHash,
      t.chunkCount,
      t.status
    )
  })
)

export type EmbedLedgerRow = typeof embedLedgerTable.$inferSelect
