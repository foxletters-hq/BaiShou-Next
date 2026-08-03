import { logger } from '@baishou/shared'
import { executeRawSql } from './raw-sql.executor'

/** 与 Agent 库同解析规则：存储根下 `knowledge.db` */
export const KNOWLEDGE_DB_FILENAME = 'knowledge.db'

/** Schema 版本：1 = 初版四表 + FTS5 + 摄入 job */
export const KNOWLEDGE_SCHEMA_VERSION = 1

export const KNOWLEDGE_NOTEBOOKS_SQL = `
  CREATE TABLE IF NOT EXISTS notebooks (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    archived      INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
  )
`

export const KNOWLEDGE_SOURCES_SQL = `
  CREATE TABLE IF NOT EXISTS knowledge_sources (
    id                  TEXT PRIMARY KEY,
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

export const KNOWLEDGE_CHUNKS_SQL = `
  CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    chunk_id      TEXT NOT NULL UNIQUE,
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

export const KNOWLEDGE_INGEST_JOBS_SQL = `
  CREATE TABLE IF NOT EXISTS knowledge_ingest_jobs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
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

  const version = await getUserVersion(client)
  if (version < KNOWLEDGE_SCHEMA_VERSION) {
    await executeRawSql(client, `PRAGMA user_version = ${KNOWLEDGE_SCHEMA_VERSION}`)
    logger.info(`${logPrefix} user_version → ${KNOWLEDGE_SCHEMA_VERSION}`)
  }
}
