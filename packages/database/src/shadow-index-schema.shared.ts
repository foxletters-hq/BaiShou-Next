import { deriveLegacyVaultId, logger } from '@baishou/shared'
import { executeRawSql } from './raw-sql.executor'
import {
  ensureVaultIdsForNames,
  loadVaultNameToIdMapFromStorageRoot,
  resolveVaultIdFromName
} from './vault-id-map'

/** 全局单库文件名（桌面 / 移动端共用） */
export const SHADOW_INDEX_DB_FILENAME = 'shadow_index_v2.db'

/**
 * Schema 版本：
 * - 1：per-vault 单库，`journals_index` 无 vault 列，唯一索引 `(file_path)`
 * - 2：全局单库多 Vault，`vault_name` + 唯一索引 `(vault_name, file_path)`
 * - 3：`journals_index` 增加 `file_mtime_ms` / `file_size`（mtime/size 快路径）
 * - 4：`vault_name` → `vault_id`（in-place rename + 回填，避免整表 DROP）
 */
export const SHADOW_INDEX_SCHEMA_VERSION = 4

export const JOURNALS_INDEX_CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS journals_index (
    id              INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    vault_id        TEXT    NOT NULL,
    file_path       TEXT    NOT NULL,
    date            TEXT    NOT NULL,
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL,
    content_hash    TEXT    NOT NULL,
    file_mtime_ms   INTEGER,
    file_size       INTEGER,
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
  CREATE UNIQUE INDEX IF NOT EXISTS journals_index_vault_id_file_path_unique
  ON journals_index (vault_id, file_path)
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
  await executeRawSql(client, 'DROP INDEX IF EXISTS journals_index_vault_file_path_unique')
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
 * V2.2：in-place 将 vault_name 列改为 vault_id 并回填，避免整表 DROP。
 */
async function migrateVaultNameToVaultIdInPlace(
  client: unknown,
  logPrefix: string,
  storageRoot?: string
): Promise<void> {
  if (!(await tableExists(client, 'journals_index'))) return
  const hasVaultId = await tableHasColumn(client, 'journals_index', 'vault_id')
  const hasVaultName = await tableHasColumn(client, 'journals_index', 'vault_name')

  if (hasVaultId && !hasVaultName) {
    // 已是 vault_id：仍把名字形态的值 remap 一次（幂等）
  } else if (hasVaultName && !hasVaultId) {
    logger.info(`${logPrefix} journals_index：RENAME vault_name → vault_id`)
    await executeRawSql(client, 'ALTER TABLE journals_index RENAME COLUMN vault_name TO vault_id')
  } else if (hasVaultName && hasVaultId) {
    await executeRawSql(
      client,
      `
      UPDATE journals_index
      SET vault_id = vault_name
      WHERE (vault_id IS NULL OR vault_id = '')
        AND vault_name IS NOT NULL AND vault_name != ''
    `
    )
    try {
      await executeRawSql(client, 'ALTER TABLE journals_index DROP COLUMN vault_name')
    } catch {
      /* 旧 SQLite */
    }
  } else {
    // 无 vault 列的极旧库：整表重建（影子索引可重建）
    logger.info(`${logPrefix} journals_index 缺少 vault 列，重建 journals_index / journals_fts`)
    await executeRawSql(client, 'DROP TABLE IF EXISTS journals_fts')
    await executeRawSql(client, 'DROP TABLE IF EXISTS journals_index')
    await dropLegacyIndexes(client)
    return
  }

  const seed = storageRoot ? loadVaultNameToIdMapFromStorageRoot(storageRoot) : undefined
  const distinct = await executeRawSql(
    client,
    `SELECT DISTINCT vault_id AS v FROM journals_index WHERE vault_id IS NOT NULL AND vault_id != ''`
  )
  const names = distinct.rows
    .map((r) => String((r as { v?: unknown }).v ?? ''))
    .filter(Boolean)
  const map = ensureVaultIdsForNames(names, seed)

  for (const old of names) {
    if (!old || old.startsWith('vlt_')) continue
    const next = resolveVaultIdFromName(old, map)
    if (next === old) continue
    await executeRawSql(client, `UPDATE journals_index SET vault_id = ? WHERE vault_id = ?`, [
      next,
      old
    ])
  }

  // 空值兜底（不应出现；填派生占位以免 NOT NULL 违规——实际不应有空行）
  void deriveLegacyVaultId
}

/**
 * 若旧表缺少 vault 列，整表重建；若仅缺 vault_id（仍为 vault_name），in-place 迁移。
 */
async function migrateLegacySchemaIfNeeded(
  client: unknown,
  logPrefix: string,
  storageRoot?: string
): Promise<void> {
  const userVersion = await getUserVersion(client)
  const indexExists = await tableExists(client, 'journals_index')

  if (!indexExists) {
    return
  }

  const hasVaultId = await tableHasColumn(client, 'journals_index', 'vault_id')
  const hasVaultName = await tableHasColumn(client, 'journals_index', 'vault_name')

  if (userVersion >= SHADOW_INDEX_SCHEMA_VERSION && hasVaultId && !hasVaultName) {
    await dropLegacyIndexes(client)
    // 仍跑一次 remap（幂等）
    await migrateVaultNameToVaultIdInPlace(client, logPrefix, storageRoot)
    return
  }

  if (hasVaultName || hasVaultId) {
    await migrateVaultNameToVaultIdInPlace(client, logPrefix, storageRoot)
    await dropLegacyIndexes(client)
    return
  }

  logger.info(
    `${logPrefix} 检测到旧版 shadow schema（user_version=${userVersion}），重建 journals_index / journals_fts`
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

async function ensureFileStatColumns(client: unknown, logPrefix: string): Promise<void> {
  if (!(await tableExists(client, 'journals_index'))) return
  if (!(await tableHasColumn(client, 'journals_index', 'file_mtime_ms'))) {
    logger.info(`${logPrefix} journals_index 添加 file_mtime_ms 列（mtime/size 快路径）`)
    await executeRawSql(client, 'ALTER TABLE journals_index ADD COLUMN file_mtime_ms INTEGER')
  }
  if (!(await tableHasColumn(client, 'journals_index', 'file_size'))) {
    logger.info(`${logPrefix} journals_index 添加 file_size 列（mtime/size 快路径）`)
    await executeRawSql(client, 'ALTER TABLE journals_index ADD COLUMN file_size INTEGER')
  }
}

/**
 * 桌面 / 移动端共用的影子索引建表与迁移入口。
 */
export async function ensureShadowIndexSchema(
  client: unknown,
  logPrefix = '[ShadowIndexSchema]',
  options?: { storageRoot?: string }
): Promise<void> {
  await migrateLegacySchemaIfNeeded(client, logPrefix, options?.storageRoot)

  await executeRawSql(client, JOURNALS_INDEX_CREATE_SQL)
  await dropLegacyIndexes(client)
  await executeRawSql(client, JOURNALS_INDEX_VAULT_FILE_PATH_UNIQUE_SQL)
  await ensureTagColorsColumn(client, logPrefix)
  await ensureFileStatColumns(client, logPrefix)
  await createJournalsFts(client, logPrefix)

  await executeRawSql(client, `PRAGMA user_version = ${SHADOW_INDEX_SCHEMA_VERSION}`)
}
