import { logger } from '@baishou/shared'
import { FTS_SYNC_TRIGGER_STATEMENTS } from './schema/fts'
import { ensureSystemSettingsTable } from './migration.service.schema'
import type { MigrationSqlExecutor } from './migration.service.types'

export const AGENT_FTS_ROWID_SYNC_VERSION_KEY = '__agent_fts_rowid_sync_version'
export const AGENT_FTS_ROWID_SYNC_VERSION = 'v1'

export const AGENT_MESSAGES_FTS_BACKFILL_SQL = `
  INSERT OR REPLACE INTO agent_messages_fts(rowid, part_id, message_id, session_id, content)
  SELECT
    p.rowid,
    p.id,
    p.message_id,
    p.session_id,
    json_extract(p.data, '$.text')
  FROM agent_parts p
  WHERE p.type = 'text'
    AND COALESCE(json_extract(p.data, '$.isReasoning'), 0) IN (0, false)
    AND json_extract(p.data, '$.text') IS NOT NULL
    AND LENGTH(TRIM(json_extract(p.data, '$.text'))) > 0
`

const AGENT_FTS_TRIGGER_NAMES = [
  'agent_parts_fts_insert',
  'agent_parts_fts_update',
  'agent_parts_fts_delete'
] as const

async function writeAgentMessagesFtsRowidVersionStamp(
  executeSql: MigrationSqlExecutor
): Promise<void> {
  await executeSql(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [AGENT_FTS_ROWID_SYNC_VERSION_KEY, AGENT_FTS_ROWID_SYNC_VERSION, Date.now()]
  )
}

async function runInTransaction(
  executeSql: MigrationSqlExecutor,
  fn: () => Promise<void>
): Promise<void> {
  await executeSql('BEGIN')
  try {
    await fn()
    await executeSql('COMMIT')
  } catch (txError) {
    try {
      await executeSql('ROLLBACK')
    } catch {
      // ignore rollback error
    }
    throw txError
  }
}

export async function markAgentMessagesFtsRowidAligned(
  executeSql: MigrationSqlExecutor
): Promise<void> {
  await ensureSystemSettingsTable(executeSql)
  await writeAgentMessagesFtsRowidVersionStamp(executeSql)
}

/**
 * 一次性幂等迁移：在单个 SQLite 事务内原子替换 agent_messages_fts 触发器、对齐存量 rowid 并记录版本印记，
 * 根除 DELETE/UPDATE 触发器在 UNINDEXED part_id 上全表扫描 FTS5 导致的长耗时锁死。
 */
export async function ensureAgentMessagesFtsRowidAligned(
  executeSql: MigrationSqlExecutor,
  options?: { skipBackfill?: boolean }
): Promise<boolean> {
  try {
    const ftsTable = await executeSql(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='agent_messages_fts'`
    )
    if (ftsTable.rows.length === 0) return false

    const partsTable = await executeSql(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='agent_parts'`
    )
    if (partsTable.rows.length === 0) return false

    const settingsTable = await executeSql(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'`
    )
    if (settingsTable.rows.length > 0) {
      const stamp = await executeSql(`SELECT value FROM system_settings WHERE key = ?`, [
        AGENT_FTS_ROWID_SYNC_VERSION_KEY
      ])
      if (stamp.rows.length > 0 && stamp.rows[0]?.value === AGENT_FTS_ROWID_SYNC_VERSION) {
        return false
      }
    }

    const startMs = Date.now()
    const recreateTriggers = async () => {
      for (const triggerName of AGENT_FTS_TRIGGER_NAMES) {
        await executeSql(`DROP TRIGGER IF EXISTS ${triggerName}`)
      }
      for (const statement of FTS_SYNC_TRIGGER_STATEMENTS) {
        await executeSql(statement)
      }
    }

    if (options?.skipBackfill) {
      await runInTransaction(executeSql, recreateTriggers)
      return false
    }

    await ensureSystemSettingsTable(executeSql)
    await runInTransaction(executeSql, async () => {
      await recreateTriggers()
      await executeSql('DELETE FROM agent_messages_fts')
      await executeSql(AGENT_MESSAGES_FTS_BACKFILL_SQL)
      await writeAgentMessagesFtsRowidVersionStamp(executeSql)
    })

    logger.info(
      `[MigrationService] Agent FTS 触发器与 rowid 索引对齐完成 (elapsedMs=${Date.now() - startMs})`
    )
    return true
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    logger.warn('[MigrationService] Agent FTS rowid 对齐迁移失败（非阻塞）:', message)
    return false
  }
}
