import { logger } from '@baishou/shared'
import { executeRawSql } from './raw-sql.executor'
import type { ExpoSqliteDatabase } from './drivers/expo-sqlite.driver'

/**
 * 移动端将影子索引表建在 Agent 同一 SQLite 库中（桌面端为 per-vault shadow_index.db）
 */
export async function ensureExpoShadowIndexSchema(client: ExpoSqliteDatabase): Promise<void> {
  await executeRawSql(
    client,
    `
      CREATE TABLE IF NOT EXISTS journals_index (
        id              INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
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
        tags            TEXT
      )
    `
  )

  await executeRawSql(
    client,
    `
      CREATE UNIQUE INDEX IF NOT EXISTS journals_index_file_path_unique
      ON journals_index (file_path)
    `
  )

  try {
    await executeRawSql(
      client,
      `
        CREATE VIRTUAL TABLE IF NOT EXISTS journals_fts
        USING fts5(
          content,
          tags,
          tokenize = 'unicode61'
        )
      `
    )
    logger.info('[ExpoShadowSchema] journals_fts FTS5 虚拟表已就绪')
  } catch (e: any) {
    logger.warn('[ExpoShadowSchema] FTS5 不可用，降级为普通表:', e.message)
    await executeRawSql(
      client,
      `
        CREATE TABLE IF NOT EXISTS journals_fts (
          rowid   INTEGER PRIMARY KEY,
          content TEXT,
          tags    TEXT
        )
      `
    )
  }
}
