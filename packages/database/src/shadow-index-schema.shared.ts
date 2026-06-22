import { logger } from '@baishou/shared'
import { executeRawSql } from './raw-sql.executor'

/** 全局单库文件名（桌面 / 移动端共用） */
export const SHADOW_INDEX_DB_FILENAME = 'shadow_index_v2.db'

/**
 * Schema 版本：
 * - 1：per-vault 单库，`journals_index` 无 `vault_name`，唯一索引 `(file_path)`
 * - 2：全局单库多 Vault，`vault_name` + 唯一索引 `(vault_name, file_path)`
 */
export const SHADOW_INDEX_SCHEMA_VERSION = 2

export const JOURNALS_INDEX_CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS journals_index (
    id              INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    vault_name      TEXT    NOT NULL,
    file_path       TEXT    NOT NULL,
    date            TEXT    NOT NULL,
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL,
    content_hash    TEXT    NOT NULL,
    weather         TEXT,
    mood            TEXT,
    location        TEXT,
    location_detail TEXT,
    is_favorite     INTEGER NOT NULL DEFAULT 0,
    has_media       INTEGER NOT NULL DEFAULT 0,
    raw_content     TEXT,
    tags            TEXT,
    tag_colors      TEXT
  )
`

export const JOURNALS_INDEX_VAULT_FILE_PATH_UNIQUE_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS journals_index_vault_file_path_unique
  ON journals_index (vault_name, file_path)
`

export const JOURNALS_FTS_FTS5_SQL = `
  CREATE VIRTUAL TABLE IF NOT EXISTS journals_fts
  USING fts5(
    content,
    tags,
    tokenize = 'unicode61'
  )
`

export const JOURNALS_FTS_FALLBACK_SQL = `
  CREATE TABLE IF NOT EXISTS journals_fts (
    rowid   INTEGER PRIMARY KEY,
    content TEXT,
    tags    TEXT
  )
`

async function tableExists(client: unknown, tableName: string): Promise<boolean> {
  const res = await executeRawSql(
    client,
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    [tableName]
  )
  return res.rows.length > 0
}

async function tableHasColumn(
  client: unknown,
  tableName: string,
  columnName: string
): Promise<boolean> {
  const res = await executeRawSql(client, `PRAGMA table_info(${tableName})`)
  return res.rows.some((row: { name?: string }) => row.name === columnName)
}

async function getUserVersion(client: unknown): Promise<number> {
  const res = await executeRawSql(client, 'PRAGMA user_version')
  const row = res.rows[0] as { user_version?: number } | undefined
  return Number(row?.user_version ?? 0)
}

async function dropLegacyIndexes(client: unknown): Promise<void> {
  await executeRawSql(client, 'DROP INDEX IF EXISTS journals_index_file_path_unique')
}

async function createJournalsFts(client: unknown, logPrefix: string): Promise<void> {
  try {
    await executeRawSql(client, JOURNALS_FTS_FTS5_SQL)
    logger.info(`${logPrefix} journals_fts FTS5 虚拟表已就绪`)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    logger.warn(`${logPrefix} FTS5 不可用，降级为普通表:`, message)
    await executeRawSql(client, JOURNALS_FTS_FALLBACK_SQL)
  }
}

/**
 * 若旧表缺少 `vault_name`，整表重建（影子索引为可重建缓存）。
 * 旧 per-vault 物理文件不在此路径时会被忽略，依赖 fullScan 重建。
 */
async function migrateLegacySchemaIfNeeded(client: unknown, logPrefix: string): Promise<void> {
  const userVersion = await getUserVersion(client)
  const indexExists = await tableExists(client, 'journals_index')

  if (!indexExists) {
    return
  }

  const hasVaultName = await tableHasColumn(client, 'journals_index', 'vault_name')
  if (userVersion >= SHADOW_INDEX_SCHEMA_VERSION && hasVaultName) {
    await dropLegacyIndexes(client)
    return
  }

  logger.info(
    `${logPrefix} 检测到旧版 shadow schema（user_version=${userVersion}, vault_name=${hasVaultName}），重建 journals_index / journals_fts`
  )

  await executeRawSql(client, 'DROP TABLE IF EXISTS journals_fts')
  await executeRawSql(client, 'DROP TABLE IF EXISTS journals_index')
  await dropLegacyIndexes(client)
}

async function ensureTagColorsColumn(client: unknown, logPrefix: string): Promise<void> {
  if (!(await tableExists(client, 'journals_index'))) return
  if (await tableHasColumn(client, 'journals_index', 'tag_colors')) return
  logger.info(`${logPrefix} journals_index 添加 tag_colors 列（frontmatter 解析缓存）`)
  await executeRawSql(client, 'ALTER TABLE journals_index ADD COLUMN tag_colors TEXT')
}

/**
 * 桌面 / 移动端共用的影子索引建表与迁移入口。
 */
export async function ensureShadowIndexSchema(
  client: unknown,
  logPrefix = '[ShadowIndexSchema]'
): Promise<void> {
  await migrateLegacySchemaIfNeeded(client, logPrefix)

  await executeRawSql(client, JOURNALS_INDEX_CREATE_SQL)
  await dropLegacyIndexes(client)
  await executeRawSql(client, JOURNALS_INDEX_VAULT_FILE_PATH_UNIQUE_SQL)
  await ensureTagColorsColumn(client, logPrefix)
  await createJournalsFts(client, logPrefix)

  await executeRawSql(client, `PRAGMA user_version = ${SHADOW_INDEX_SCHEMA_VERSION}`)
}
