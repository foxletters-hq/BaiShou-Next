/**
 * Agent DB 旧库列补齐清单。
 *
 * 背景：0000/0001/0002 曾拆成多条 Drizzle 迁移，后 squash 为单条 0000_agent_schema。
 * 旧开发库若只回填了 idx=0，或从未执行 0002，会出现「迁移记录已最新但缺列」。
 * 启动时按本清单 PRAGMA 检测并 ALTER TABLE / CREATE TABLE IF NOT EXISTS。
 *
 * 新增 Drizzle 列时：同步更新此处、0000 SQL（db:generate）与单测。
 */
export interface AgentSchemaColumnPatch {
  table: string
  column: string
  /** 列不存在时执行的 DDL（须含 ADD COLUMN 或整表 CREATE） */
  ddl: string
}

/** 原 0001 迁移内容；旧库可能仅有 agent 核心表而无向量表 */
export const MEMORY_EMBEDDINGS_CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS memory_embeddings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    embedding_id    TEXT NOT NULL,
    source_type     TEXT NOT NULL,
    source_id       TEXT NOT NULL,
    group_id        TEXT NOT NULL,
    chunk_index     INTEGER DEFAULT 0 NOT NULL,
    chunk_text      TEXT NOT NULL,
    metadata_json   TEXT DEFAULT '{}' NOT NULL,
    embedding       BLOB NOT NULL,
    dimension       INTEGER NOT NULL,
    model_id        TEXT DEFAULT '' NOT NULL,
    created_at      INTEGER NOT NULL,
    source_created_at INTEGER
  )
`

export const MEMORY_EMBEDDINGS_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS memory_embeddings_embedding_id_unique
  ON memory_embeddings (embedding_id)
`

/** 日记 RAG 嵌入欠账表；成功后删行，不保留永久历史 */
export const DIARY_EMBED_JOBS_CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS diary_embed_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    vault_name TEXT NOT NULL,
    diary_id INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    next_retry_at INTEGER,
    updated_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )
`

export const DIARY_EMBED_JOBS_INDEXES_SQL = [
  `CREATE UNIQUE INDEX IF NOT EXISTS diary_embed_jobs_vault_diary_unique
   ON diary_embed_jobs (vault_name, diary_id)`,
  `CREATE INDEX IF NOT EXISTS diary_embed_jobs_status_retry_idx
   ON diary_embed_jobs (status, next_retry_at)`
] as const

/** 原 0000 迁移内容；Flutter v3 agent.sqlite 无此表，但迁移记录可能被误标为已执行 */
export const SYSTEM_SETTINGS_CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer))
  )
`

/** Graph nodes / edges（P1）；旧库无迁移记录时靠兜底建表 */
export const GRAPH_NODES_CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS graph_nodes (
    id TEXT PRIMARY KEY NOT NULL,
    vault_name TEXT NOT NULL,
    node_type TEXT NOT NULL,
    name TEXT NOT NULL,
    aliases TEXT DEFAULT '[]' NOT NULL,
    summary TEXT DEFAULT '' NOT NULL,
    props_json TEXT DEFAULT '{}' NOT NULL,
    embedding BLOB,
    dimension INTEGER,
    model_id TEXT DEFAULT '' NOT NULL,
    mention_count INTEGER DEFAULT 0 NOT NULL,
    first_seen_at INTEGER,
    last_seen_at INTEGER,
    origin TEXT DEFAULT 'ai' NOT NULL,
    shard_month TEXT DEFAULT '' NOT NULL,
    review_status TEXT DEFAULT 'approved' NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  )
`

export const GRAPH_EDGES_CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS graph_edges (
    id TEXT PRIMARY KEY NOT NULL,
    vault_name TEXT NOT NULL,
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    edge_type TEXT NOT NULL,
    props_json TEXT DEFAULT '{}' NOT NULL,
    valid_from INTEGER,
    valid_to INTEGER,
    is_current INTEGER DEFAULT 1 NOT NULL,
    source_kind TEXT DEFAULT 'diary' NOT NULL,
    source_ref TEXT,
    source_excerpt TEXT DEFAULT '' NOT NULL,
    source_content_hash TEXT,
    confidence INTEGER DEFAULT 100 NOT NULL,
    origin TEXT DEFAULT 'ai' NOT NULL,
    review_status TEXT DEFAULT 'approved' NOT NULL,
    shard_month TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  )
`

export const GRAPH_INDEXES_SQL = [
  `CREATE INDEX IF NOT EXISTS graph_nodes_vault_type ON graph_nodes(vault_name, node_type)`,
  `CREATE INDEX IF NOT EXISTS graph_edges_from ON graph_edges(from_id)`,
  `CREATE INDEX IF NOT EXISTS graph_edges_to ON graph_edges(to_id)`,
  `CREATE INDEX IF NOT EXISTS graph_edges_vault_type_current ON graph_edges(vault_name, edge_type, is_current)`,
  `CREATE INDEX IF NOT EXISTS graph_edges_source_ref ON graph_edges(vault_name, source_ref)`,
  `CREATE INDEX IF NOT EXISTS graph_edges_shard_month ON graph_edges(vault_name, shard_month)`
] as const

/**
 * 按表聚合的缺列补丁（顺序无关，逐条检测后执行）。
 */
export const AGENT_DB_COLUMN_PATCHES: AgentSchemaColumnPatch[] = [
  // ── agent_assistants ──
  {
    table: 'agent_assistants',
    column: 'compress_token_threshold',
    ddl: `ALTER TABLE agent_assistants ADD COLUMN compress_token_threshold INTEGER NOT NULL DEFAULT 60000`
  },
  {
    table: 'agent_assistants',
    column: 'compress_keep_turns',
    ddl: `ALTER TABLE agent_assistants ADD COLUMN compress_keep_turns INTEGER NOT NULL DEFAULT 3`
  },
  {
    table: 'agent_assistants',
    column: 'compress_model_context_window',
    ddl: `ALTER TABLE agent_assistants ADD COLUMN compress_model_context_window INTEGER`
  },
  {
    table: 'agent_assistants',
    column: 'compress_preserve_recent_tokens',
    ddl: `ALTER TABLE agent_assistants ADD COLUMN compress_preserve_recent_tokens INTEGER`
  },
  {
    table: 'agent_assistants',
    column: 'compress_system_prompt',
    ddl: `ALTER TABLE agent_assistants ADD COLUMN compress_system_prompt TEXT`
  },
  {
    table: 'agent_assistants',
    column: 'assistant_kind',
    ddl: `ALTER TABLE agent_assistants ADD COLUMN assistant_kind TEXT NOT NULL DEFAULT 'companion'`
  },
  {
    table: 'agent_assistants',
    column: 'emoji_group_id',
    ddl: `ALTER TABLE agent_assistants ADD COLUMN emoji_group_id TEXT`
  },
  {
    table: 'agent_assistants',
    column: 'emoji_enabled',
    ddl: `ALTER TABLE agent_assistants ADD COLUMN emoji_enabled INTEGER NOT NULL DEFAULT 0`
  },
  {
    table: 'agent_assistants',
    column: 'emoji_group_ids',
    ddl: `ALTER TABLE agent_assistants ADD COLUMN emoji_group_ids TEXT`
  },
  // ── agent_sessions（原 0002_cache_token_usage）──
  {
    table: 'agent_sessions',
    column: 'total_cache_read_input_tokens',
    ddl: `ALTER TABLE agent_sessions ADD COLUMN total_cache_read_input_tokens INTEGER NOT NULL DEFAULT 0`
  },
  {
    table: 'agent_sessions',
    column: 'total_cache_write_input_tokens',
    ddl: `ALTER TABLE agent_sessions ADD COLUMN total_cache_write_input_tokens INTEGER NOT NULL DEFAULT 0`
  },
  {
    table: 'agent_sessions',
    column: 'total_cost_micros',
    ddl: `ALTER TABLE agent_sessions ADD COLUMN total_cost_micros INTEGER NOT NULL DEFAULT 0`
  },
  // ── agent_messages（原 0002_cache_token_usage）──
  {
    table: 'agent_messages',
    column: 'order_index',
    ddl: `ALTER TABLE agent_messages ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0`
  },
  {
    table: 'agent_messages',
    column: 'cache_read_input_tokens',
    ddl: `ALTER TABLE agent_messages ADD COLUMN cache_read_input_tokens INTEGER`
  },
  {
    table: 'agent_messages',
    column: 'cache_write_input_tokens',
    ddl: `ALTER TABLE agent_messages ADD COLUMN cache_write_input_tokens INTEGER`
  },
  {
    table: 'agent_messages',
    column: 'cost_micros',
    ddl: `ALTER TABLE agent_messages ADD COLUMN cost_micros INTEGER`
  },
  // ── compression_snapshots ──
  {
    table: 'compression_snapshots',
    column: 'tail_start_message_id',
    ddl: `ALTER TABLE compression_snapshots ADD COLUMN tail_start_message_id TEXT`
  },
  // ── summaries ──
  {
    table: 'summaries',
    column: 'updated_at',
    ddl: `ALTER TABLE summaries ADD COLUMN updated_at INTEGER`
  }
]
