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
  }
]
