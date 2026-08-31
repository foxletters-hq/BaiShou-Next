import { sql } from 'drizzle-orm'
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
    sortOrder: integer('sort_order').notNull().default(0),
    coverTone: text('cover_tone').notNull().default(''),
    coverIcon: text('cover_icon').notNull().default(''),
    coverImage: text('cover_image').notNull().default(''),
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

/** 知识本图谱节点（与日记 graph_nodes 隔离） */
export const notebookGraphNodesTable = sqliteTable(
  'notebook_graph_nodes',
  {
    id: text('id').primaryKey(),
    vaultId: text('vault_id').notNull(),
    notebookId: text('notebook_id').notNull(),
    nodeType: text('node_type').notNull(),
    name: text('name').notNull(),
    nameNormalized: text('name_normalized').notNull().default(''),
    aliases: text('aliases').notNull().default('[]'),
    summary: text('summary').notNull().default(''),
    propsJson: text('props_json').notNull().default('{}'),
    mentionCount: integer('mention_count').notNull().default(0),
    firstSeenAt: integer('first_seen_at'),
    lastSeenAt: integer('last_seen_at'),
    origin: text('origin').notNull().default('ai'),
    shardMonth: text('shard_month').notNull().default(''),
    reviewStatus: text('review_status').notNull().default('approved'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at')
  },
  (t) => ({
    notebookIdx: index('idx_nb_graph_nodes_notebook').on(t.notebookId),
    vaultNotebookIdx: index('idx_nb_graph_nodes_vault_nb').on(t.vaultId, t.notebookId),
    liveName: uniqueIndex('idx_nb_graph_nodes_live_name')
      .on(t.vaultId, t.notebookId, t.nodeType, t.nameNormalized)
      .where(sql`${t.deletedAt} is null and ${t.nodeType} != 'source'`)
  })
)

export const notebookGraphAliasesTable = sqliteTable(
  'notebook_graph_aliases',
  {
    id: text('id').primaryKey(),
    vaultId: text('vault_id').notNull(),
    notebookId: text('notebook_id').notNull(),
    nodeId: text('node_id').notNull(),
    aliasNormalized: text('alias_normalized').notNull()
  },
  (t) => ({
    aliasIdx: index('idx_nb_graph_aliases_lookup').on(t.vaultId, t.notebookId, t.aliasNormalized),
    nodeIdx: index('idx_nb_graph_aliases_node').on(t.nodeId)
  })
)

export const notebookGraphEdgesTable = sqliteTable(
  'notebook_graph_edges',
  {
    id: text('id').primaryKey(),
    vaultId: text('vault_id').notNull(),
    notebookId: text('notebook_id').notNull(),
    fromId: text('from_id').notNull(),
    toId: text('to_id').notNull(),
    edgeType: text('edge_type').notNull(),
    propsJson: text('props_json').notNull().default('{}'),
    validFrom: integer('valid_from'),
    validTo: integer('valid_to'),
    isCurrent: integer('is_current').notNull().default(1),
    sourceKind: text('source_kind').notNull().default('knowledge'),
    sourceRef: text('source_ref'),
    sourceExcerpt: text('source_excerpt').notNull().default(''),
    sourceContentHash: text('source_content_hash'),
    confidence: integer('confidence').notNull().default(100),
    origin: text('origin').notNull().default('ai'),
    reviewStatus: text('review_status').notNull().default('approved'),
    shardMonth: text('shard_month').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at')
  },
  (t) => ({
    notebookIdx: index('idx_nb_graph_edges_notebook').on(t.notebookId),
    fromIdx: index('idx_nb_graph_edges_from').on(t.fromId),
    toIdx: index('idx_nb_graph_edges_to').on(t.toId),
    sourceRefIdx: index('idx_nb_graph_edges_source_ref').on(t.notebookId, t.sourceRef)
  })
)

export type NotebookGraphNodeRow = typeof notebookGraphNodesTable.$inferSelect
export type NotebookGraphEdgeRow = typeof notebookGraphEdgesTable.$inferSelect
