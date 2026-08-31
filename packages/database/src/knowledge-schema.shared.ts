import { logger } from '@baishou/shared'
import { executeRawSql } from './raw-sql.executor'

/** 与 Agent 库同解析规则：存储根下 `knowledge.db` */
export const KNOWLEDGE_DB_FILENAME = 'knowledge.db'

/**
 * Schema 版本：
 * 1 = 初版四表 + FTS5 + 摄入 job
 * 2 = notebooks/sources/chunks/jobs 加 vault_id（多仓隔离）
 * 3 = 每本笔记本独立图谱表 notebook_graph_*
 * 4 = notebooks 加 sort_order / cover_tone（列表排序与封面色）
 * 5 = notebooks 加 cover_icon / cover_image（封面 emoji 与上传封面）
 */
export const KNOWLEDGE_SCHEMA_VERSION = 5

export const KNOWLEDGE_NOTEBOOKS_SQL = `
  CREATE TABLE IF NOT EXISTS notebooks (
    id            TEXT PRIMARY KEY,
    vault_id      TEXT NOT NULL DEFAULT '',
    name          TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    archived      INTEGER NOT NULL DEFAULT 0,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    cover_tone    TEXT NOT NULL DEFAULT '',
    cover_icon    TEXT NOT NULL DEFAULT '',
    cover_image   TEXT NOT NULL DEFAULT '',
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
  )
`

export const KNOWLEDGE_SOURCES_SQL = `
  CREATE TABLE IF NOT EXISTS knowledge_sources (
    id                  TEXT PRIMARY KEY,
    vault_id            TEXT NOT NULL DEFAULT '',
    notebook_id         TEXT NOT NULL,
    title               TEXT NOT NULL,
    source_kind         TEXT NOT NULL,
    relative_path       TEXT,
    origin_url          TEXT,
    content_hash        TEXT NOT NULL,
    extracted_text_hash TEXT,
    extract_engine      TEXT NOT NULL DEFAULT 'simple',
    page_count          INTEGER,
    text_page_count     INTEGER,
    status              TEXT NOT NULL,
    error_message       TEXT,
    byte_size           INTEGER NOT NULL DEFAULT 0,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
  )
`

export const KNOWLEDGE_SOURCES_NOTEBOOK_IDX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_knowledge_sources_notebook
  ON knowledge_sources(notebook_id)
`

export const KNOWLEDGE_SOURCES_VAULT_IDX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_knowledge_sources_vault
  ON knowledge_sources(vault_id)
`

export const KNOWLEDGE_CHUNKS_SQL = `
  CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    chunk_id      TEXT NOT NULL UNIQUE,
    vault_id      TEXT NOT NULL DEFAULT '',
    notebook_id   TEXT NOT NULL,
    source_id     TEXT NOT NULL,
    chunk_index   INTEGER NOT NULL,
    chunk_text    TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    embedding     BLOB NOT NULL,
    dimension     INTEGER NOT NULL,
    model_id      TEXT NOT NULL DEFAULT '',
    created_at    INTEGER NOT NULL
  )
`

export const KNOWLEDGE_CHUNKS_NOTEBOOK_IDX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_notebook
  ON knowledge_chunks(notebook_id)
`

export const KNOWLEDGE_CHUNKS_SOURCE_IDX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source
  ON knowledge_chunks(source_id)
`

export const KNOWLEDGE_CHUNKS_VAULT_IDX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_vault
  ON knowledge_chunks(vault_id)
`

export const KNOWLEDGE_NOTEBOOKS_VAULT_IDX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_notebooks_vault
  ON notebooks(vault_id)
`

export const KNOWLEDGE_CHUNKS_FTS5_SQL = `
  CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks_fts USING fts5(
    chunk_text,
    content='knowledge_chunks',
    content_rowid='id',
    tokenize='unicode61'
  )
`

export const KNOWLEDGE_CHUNKS_FTS_TRIGGERS = [
  `CREATE TRIGGER IF NOT EXISTS knowledge_chunks_fts_ai
AFTER INSERT ON knowledge_chunks BEGIN
  INSERT INTO knowledge_chunks_fts(rowid, chunk_text) VALUES (new.id, new.chunk_text);
END`,
  `CREATE TRIGGER IF NOT EXISTS knowledge_chunks_fts_ad
AFTER DELETE ON knowledge_chunks BEGIN
  INSERT INTO knowledge_chunks_fts(knowledge_chunks_fts, rowid, chunk_text)
  VALUES('delete', old.id, old.chunk_text);
END`,
  `CREATE TRIGGER IF NOT EXISTS knowledge_chunks_fts_au
AFTER UPDATE OF chunk_text ON knowledge_chunks BEGIN
  INSERT INTO knowledge_chunks_fts(knowledge_chunks_fts, rowid, chunk_text)
  VALUES('delete', old.id, old.chunk_text);
  INSERT INTO knowledge_chunks_fts(rowid, chunk_text) VALUES (new.id, new.chunk_text);
END`
] as const

export const KNOWLEDGE_SOURCES_STATUS_IDX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_knowledge_sources_status
  ON knowledge_sources(status)
`

export const NOTEBOOK_GRAPH_NODES_SQL = `
  CREATE TABLE IF NOT EXISTS notebook_graph_nodes (
    id              TEXT PRIMARY KEY,
    vault_id        TEXT NOT NULL,
    notebook_id     TEXT NOT NULL,
    node_type       TEXT NOT NULL,
    name            TEXT NOT NULL,
    name_normalized TEXT NOT NULL DEFAULT '',
    aliases         TEXT NOT NULL DEFAULT '[]',
    summary         TEXT NOT NULL DEFAULT '',
    props_json      TEXT NOT NULL DEFAULT '{}',
    mention_count   INTEGER NOT NULL DEFAULT 0,
    first_seen_at   INTEGER,
    last_seen_at    INTEGER,
    origin          TEXT NOT NULL DEFAULT 'ai',
    shard_month     TEXT NOT NULL DEFAULT '',
    review_status   TEXT NOT NULL DEFAULT 'approved',
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    deleted_at      INTEGER
  )
`

export const NOTEBOOK_GRAPH_ALIASES_SQL = `
  CREATE TABLE IF NOT EXISTS notebook_graph_aliases (
    id               TEXT PRIMARY KEY,
    vault_id         TEXT NOT NULL,
    notebook_id      TEXT NOT NULL,
    node_id          TEXT NOT NULL,
    alias_normalized TEXT NOT NULL
  )
`

export const NOTEBOOK_GRAPH_EDGES_SQL = `
  CREATE TABLE IF NOT EXISTS notebook_graph_edges (
    id                  TEXT PRIMARY KEY,
    vault_id            TEXT NOT NULL,
    notebook_id         TEXT NOT NULL,
    from_id             TEXT NOT NULL,
    to_id               TEXT NOT NULL,
    edge_type           TEXT NOT NULL,
    props_json          TEXT NOT NULL DEFAULT '{}',
    valid_from          INTEGER,
    valid_to            INTEGER,
    is_current          INTEGER NOT NULL DEFAULT 1,
    source_kind         TEXT NOT NULL DEFAULT 'knowledge',
    source_ref          TEXT,
    source_excerpt      TEXT NOT NULL DEFAULT '',
    source_content_hash TEXT,
    confidence          INTEGER NOT NULL DEFAULT 100,
    origin              TEXT NOT NULL DEFAULT 'ai',
    review_status       TEXT NOT NULL DEFAULT 'approved',
    shard_month         TEXT NOT NULL,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL,
    deleted_at          INTEGER
  )
`

export const NOTEBOOK_GRAPH_PURGE_SOFT_DELETED_SQL = [
  `DELETE FROM notebook_graph_edges WHERE deleted_at IS NOT NULL`,
  `DELETE FROM notebook_graph_edges WHERE from_id IN (SELECT id FROM notebook_graph_nodes WHERE deleted_at IS NOT NULL)
    OR to_id IN (SELECT id FROM notebook_graph_nodes WHERE deleted_at IS NOT NULL)`,
  `DELETE FROM notebook_graph_aliases WHERE node_id IN (SELECT id FROM notebook_graph_nodes WHERE deleted_at IS NOT NULL)`,
  `DELETE FROM notebook_graph_nodes WHERE deleted_at IS NOT NULL`
] as const

export const NOTEBOOK_GRAPH_INDEXES_SQL = [
  `CREATE INDEX IF NOT EXISTS idx_nb_graph_nodes_notebook ON notebook_graph_nodes(notebook_id)`,
  `CREATE INDEX IF NOT EXISTS idx_nb_graph_nodes_vault_nb ON notebook_graph_nodes(vault_id, notebook_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_nb_graph_nodes_live_name
    ON notebook_graph_nodes(vault_id, notebook_id, node_type, name_normalized)
    WHERE deleted_at IS NULL AND node_type != 'source'`,
  `CREATE INDEX IF NOT EXISTS idx_nb_graph_aliases_lookup
    ON notebook_graph_aliases(vault_id, notebook_id, alias_normalized)`,
  `CREATE INDEX IF NOT EXISTS idx_nb_graph_aliases_node ON notebook_graph_aliases(node_id)`,
  `CREATE INDEX IF NOT EXISTS idx_nb_graph_edges_notebook ON notebook_graph_edges(notebook_id)`,
  `CREATE INDEX IF NOT EXISTS idx_nb_graph_edges_from ON notebook_graph_edges(from_id)`,
  `CREATE INDEX IF NOT EXISTS idx_nb_graph_edges_to ON notebook_graph_edges(to_id)`,
  `CREATE INDEX IF NOT EXISTS idx_nb_graph_edges_source_ref ON notebook_graph_edges(notebook_id, source_ref)`
] as const

export const KNOWLEDGE_INGEST_JOBS_STATUS_RETRY_IDX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_knowledge_ingest_jobs_status_retry
  ON knowledge_ingest_jobs(status, next_retry_at)
`

export const KNOWLEDGE_INGEST_JOBS_SQL = `
  CREATE TABLE IF NOT EXISTS knowledge_ingest_jobs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_id      TEXT NOT NULL DEFAULT '',
    notebook_id   TEXT NOT NULL,
    source_id     TEXT NOT NULL,
    stage         TEXT NOT NULL,
    status        TEXT NOT NULL,
    attempts      INTEGER NOT NULL DEFAULT 0,
    last_error    TEXT,
    next_retry_at INTEGER,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    UNIQUE(source_id, stage)
  )
`

async function getUserVersion(client: unknown): Promise<number> {
  const res = await executeRawSql(client, 'PRAGMA user_version')
  const row = res.rows[0] as { user_version?: number } | undefined
  return Number(row?.user_version ?? 0)
}

async function tableHasColumn(client: unknown, table: string, column: string): Promise<boolean> {
  const res = await executeRawSql(client, `PRAGMA table_info(${table})`)
  return res.rows.some((r) => {
    const name = String((r as { name?: unknown }).name ?? '')
    return name === column
  })
}

async function ensureVaultIdColumn(
  client: unknown,
  table: string,
  logPrefix: string
): Promise<void> {
  if (await tableHasColumn(client, table, 'vault_id')) return
  await executeRawSql(client, `ALTER TABLE ${table} ADD COLUMN vault_id TEXT NOT NULL DEFAULT ''`)
  logger.info(`${logPrefix} ${table}.vault_id 已补齐`)
}

async function createKnowledgeFts(client: unknown, logPrefix: string): Promise<void> {
  try {
    await executeRawSql(client, KNOWLEDGE_CHUNKS_FTS5_SQL)
    for (const stmt of KNOWLEDGE_CHUNKS_FTS_TRIGGERS) {
      await executeRawSql(client, stmt)
    }
    logger.info(`${logPrefix} knowledge_chunks_fts FTS5 虚拟表已就绪`)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    logger.warn(`${logPrefix} knowledge FTS5 不可用，跳过:`, message)
  }
}

/**
 * 知识库独立建表入口（不进 Agent MigrationService）。
 */
export async function ensureKnowledgeSchema(
  client: unknown,
  logPrefix = '[KnowledgeSchema]'
): Promise<void> {
  await executeRawSql(client, KNOWLEDGE_NOTEBOOKS_SQL)
  await executeRawSql(client, KNOWLEDGE_SOURCES_SQL)
  await executeRawSql(client, KNOWLEDGE_SOURCES_NOTEBOOK_IDX_SQL)
  await executeRawSql(client, KNOWLEDGE_CHUNKS_SQL)
  await executeRawSql(client, KNOWLEDGE_CHUNKS_NOTEBOOK_IDX_SQL)
  await executeRawSql(client, KNOWLEDGE_CHUNKS_SOURCE_IDX_SQL)
  await createKnowledgeFts(client, logPrefix)
  await executeRawSql(client, KNOWLEDGE_INGEST_JOBS_SQL)

  // v2：存量库补 vault_id（新建表 SQL 已含列；旧库靠 ALTER）
  await ensureVaultIdColumn(client, 'notebooks', logPrefix)
  await ensureVaultIdColumn(client, 'knowledge_sources', logPrefix)
  await ensureVaultIdColumn(client, 'knowledge_chunks', logPrefix)
  await ensureVaultIdColumn(client, 'knowledge_ingest_jobs', logPrefix)
  await executeRawSql(client, KNOWLEDGE_NOTEBOOKS_VAULT_IDX_SQL)
  await executeRawSql(client, KNOWLEDGE_SOURCES_VAULT_IDX_SQL)
  await executeRawSql(client, KNOWLEDGE_CHUNKS_VAULT_IDX_SQL)
  await executeRawSql(client, KNOWLEDGE_SOURCES_STATUS_IDX_SQL)
  await executeRawSql(client, KNOWLEDGE_INGEST_JOBS_STATUS_RETRY_IDX_SQL)
  await executeRawSql(client, NOTEBOOK_GRAPH_NODES_SQL)
  await executeRawSql(client, NOTEBOOK_GRAPH_ALIASES_SQL)
  await executeRawSql(client, NOTEBOOK_GRAPH_EDGES_SQL)
  for (const stmt of NOTEBOOK_GRAPH_INDEXES_SQL) {
    await executeRawSql(client, stmt)
  }
  for (const stmt of NOTEBOOK_GRAPH_PURGE_SOFT_DELETED_SQL) {
    await executeRawSql(client, stmt)
  }

  // v4：存量库补列表排序与封面色
  if (!(await tableHasColumn(client, 'notebooks', 'sort_order'))) {
    await executeRawSql(
      client,
      `ALTER TABLE notebooks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`
    )
    logger.info(`${logPrefix} notebooks.sort_order 已补齐`)
  }
  if (!(await tableHasColumn(client, 'notebooks', 'cover_tone'))) {
    await executeRawSql(client, `ALTER TABLE notebooks ADD COLUMN cover_tone TEXT NOT NULL DEFAULT ''`)
    logger.info(`${logPrefix} notebooks.cover_tone 已补齐`)
  }
  if (!(await tableHasColumn(client, 'notebooks', 'cover_icon'))) {
    await executeRawSql(client, `ALTER TABLE notebooks ADD COLUMN cover_icon TEXT NOT NULL DEFAULT ''`)
    logger.info(`${logPrefix} notebooks.cover_icon 已补齐`)
  }
  if (!(await tableHasColumn(client, 'notebooks', 'cover_image'))) {
    await executeRawSql(
      client,
      `ALTER TABLE notebooks ADD COLUMN cover_image TEXT NOT NULL DEFAULT ''`
    )
    logger.info(`${logPrefix} notebooks.cover_image 已补齐`)
  }

  const version = await getUserVersion(client)
  if (version < KNOWLEDGE_SCHEMA_VERSION) {
    await executeRawSql(client, `PRAGMA user_version = ${KNOWLEDGE_SCHEMA_VERSION}`)
    logger.info(`${logPrefix} user_version → ${KNOWLEDGE_SCHEMA_VERSION}`)
  }
}
