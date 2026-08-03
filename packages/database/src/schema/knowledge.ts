import { sqliteTable, integer, text, customType, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

const sqliteVecBlob = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'blob'
  },
  toDriver(val: Buffer): Buffer {
    return val
  },
  fromDriver(val: unknown): Buffer {
    return val as Buffer
  }
})

/** 笔记本：主题容器（按 vault_id 多仓隔离） */
export const notebooksTable = sqliteTable(
  'notebooks',
  {
    id: text('id').primaryKey(),
    vaultId: text('vault_id').notNull().default(''),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    archived: integer('archived').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
  },
  (t) => ({
    vaultIdx: index('idx_notebooks_vault').on(t.vaultId)
  })
)

/** 资料：不可变原材料 */
export const knowledgeSourcesTable = sqliteTable(
  'knowledge_sources',
  {
    id: text('id').primaryKey(),
    vaultId: text('vault_id').notNull().default(''),
    notebookId: text('notebook_id').notNull(),
    title: text('title').notNull(),
    sourceKind: text('source_kind').notNull(),
    relativePath: text('relative_path'),
    originUrl: text('origin_url'),
    contentHash: text('content_hash').notNull(),
    extractedTextHash: text('extracted_text_hash'),
    extractEngine: text('extract_engine').notNull().default('simple'),
    pageCount: integer('page_count'),
    textPageCount: integer('text_page_count'),
    status: text('status').notNull(),
    errorMessage: text('error_message'),
    byteSize: integer('byte_size').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
  },
  (t) => ({
    notebookIdx: index('idx_knowledge_sources_notebook').on(t.notebookId),
    vaultIdx: index('idx_knowledge_sources_vault').on(t.vaultId)
  })
)

/** 分块向量 */
export const knowledgeChunksTable = sqliteTable(
  'knowledge_chunks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    chunkId: text('chunk_id').notNull().unique(),
    vaultId: text('vault_id').notNull().default(''),
    notebookId: text('notebook_id').notNull(),
    sourceId: text('source_id').notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    chunkText: text('chunk_text').notNull(),
    metadataJson: text('metadata_json').notNull().default('{}'),
    embedding: sqliteVecBlob('embedding').notNull(),
    dimension: integer('dimension').notNull(),
    modelId: text('model_id').notNull().default(''),
    createdAt: integer('created_at').notNull()
  },
  (t) => ({
    notebookIdx: index('idx_knowledge_chunks_notebook').on(t.notebookId),
    sourceIdx: index('idx_knowledge_chunks_source').on(t.sourceId),
    vaultIdx: index('idx_knowledge_chunks_vault').on(t.vaultId)
  })
)

/** 摄入欠账：extract | embed */
export const knowledgeIngestJobsTable = sqliteTable(
  'knowledge_ingest_jobs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    vaultId: text('vault_id').notNull().default(''),
    notebookId: text('notebook_id').notNull(),
    sourceId: text('source_id').notNull(),
    stage: text('stage').notNull(),
    status: text('status').notNull(),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    nextRetryAt: integer('next_retry_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull()
  },
  (t) => ({
    sourceStageUniq: uniqueIndex('knowledge_ingest_jobs_source_stage_unique').on(
      t.sourceId,
      t.stage
    )
  })
)

export type NotebookRow = typeof notebooksTable.$inferSelect
export type KnowledgeSourceRow = typeof knowledgeSourcesTable.$inferSelect
export type KnowledgeChunkRow = typeof knowledgeChunksTable.$inferSelect
export type KnowledgeIngestJobRow = typeof knowledgeIngestJobsTable.$inferSelect
