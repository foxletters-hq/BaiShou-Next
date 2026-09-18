import { logger } from '@baishou/shared'
import {
  AGENT_DB_COLUMN_PATCHES,
  MIGRATE_DIARY_EMBED_JOBS_INTO_LEDGER_SQL,
  EMBED_LEDGER_CREATE_SQL,
  EMBED_LEDGER_INDEXES_SQL,
  GRAPH_EDGES_CREATE_SQL,
  GRAPH_INDEXES_SQL,
  GRAPH_NODE_ALIASES_CREATE_SQL,
  GRAPH_NODES_CREATE_SQL,
  GRAPH_PURGE_SOFT_DELETED_SQL,
  MEMORY_EMBEDDINGS_CREATE_SQL,
  MEMORY_EMBEDDINGS_INDEX_SQL,
  MEMORY_EMBEDDINGS_VAULT_INDEX_SQL,
  SYSTEM_SETTINGS_CREATE_SQL
} from './agent-schema-compat'
import { backfillMemoryEmbeddingsVaultName } from './memory-embeddings-vault-backfill'
import { migrateAgentDbVaultNameToVaultId } from './vault-id-backfill'
import { loadVaultNameToIdMapFromStorageRoot } from './vault-id-map'
import { migrateSummariesAndAssistantsVaultV14 } from './summaries-assistants-vault-v14'
import type { MigrationSqlExecutor } from './migration.service.types'

export async function ensureSystemSettingsTable(executeSql: MigrationSqlExecutor): Promise<void> {
  try {
    const table = await executeSql(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'`
    )
    if (table.rows.length > 0) return

    logger.info('[MigrationService] 创建缺失的 system_settings 表...')
    await executeSql(SYSTEM_SETTINGS_CREATE_SQL)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    logger.warn('[MigrationService] system_settings 表检查失败（非阻塞）:', message)
  }
}

export async function ensureMemoryEmbeddingsTable(executeSql: MigrationSqlExecutor): Promise<void> {
  try {
    const table = await executeSql(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='memory_embeddings'`
    )
    if (table.rows.length > 0) return

    logger.info('[MigrationService] 创建缺失的 memory_embeddings 表...')
    await executeSql(MEMORY_EMBEDDINGS_CREATE_SQL)
    await executeSql(MEMORY_EMBEDDINGS_INDEX_SQL)
    await executeSql(MEMORY_EMBEDDINGS_VAULT_INDEX_SQL)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    logger.warn('[MigrationService] memory_embeddings 表检查失败（非阻塞）:', message)
  }
}

export async function ensureMemoryEmbeddingsVaultIndex(
  executeSql: MigrationSqlExecutor
): Promise<void> {
  try {
    const table = await executeSql(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='memory_embeddings'`
    )
    if (table.rows.length === 0) return
    await executeSql(MEMORY_EMBEDDINGS_VAULT_INDEX_SQL)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    logger.warn('[MigrationService] memory_embeddings vault 索引检查失败（非阻塞）:', message)
  }
}

/** 仓库隔离 V1.0：回填 vault_name（幂等；遗留手动记忆保持空值）。须在 V2.2 rename 之前执行。 */
export async function backfillMemoryEmbeddingsVaultNameColumn(
  executeSql: MigrationSqlExecutor
): Promise<void> {
  try {
    const table = await executeSql(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='memory_embeddings'`
    )
    if (table.rows.length === 0) return
    const tableInfo = await executeSql(`PRAGMA table_info(memory_embeddings)`)
    const hasVaultName = tableInfo.rows.some((c: { name?: string }) => c.name === 'vault_name')
    if (!hasVaultName) return

    const counts = await backfillMemoryEmbeddingsVaultName((sql, args) => executeSql(sql, args))
    logger.info('[MigrationService] memory_embeddings.vault_name 回填完成', {
      ...counts
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    logger.warn('[MigrationService] memory_embeddings.vault_name 回填失败（非阻塞）:', message)
  }
}

/** 仓库身份 V2.2：vault_name → vault_id + diary source_id 前缀重写 */
export async function migrateVaultNameToVaultId(
  executeSql: MigrationSqlExecutor,
  storageRoot?: string
): Promise<void> {
  try {
    const seed = storageRoot ? loadVaultNameToIdMapFromStorageRoot(storageRoot) : undefined
    const counts = await migrateAgentDbVaultNameToVaultId(
      (sql, args) => executeSql(sql, args),
      seed
    )
    logger.info('[MigrationService] vault_name→vault_id 回填完成', { ...counts })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    logger.warn('[MigrationService] vault_name→vault_id 回填失败（非阻塞）:', message)
  }
}

/** 仓库隔离 V1.4：summaries / agent_assistants 加 vault_id + 唯一约束 / 复合主键 */
export async function migrateSummariesAndAssistantsVault(
  executeSql: MigrationSqlExecutor
): Promise<void> {
  try {
    const result = await migrateSummariesAndAssistantsVaultV14((sql, args) => executeSql(sql, args))
    logger.info('[MigrationService] summaries/assistants vault_id V1.4 完成', result)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    logger.warn('[MigrationService] summaries/assistants vault_id V1.4 失败（非阻塞）:', message)
  }
}

/** 确保 graph_nodes / graph_edges / aliases 存在；缺 name_normalized / discriminator 时先补列再重建索引。 */
export async function ensureGraphTables(executeSql: MigrationSqlExecutor): Promise<void> {
  try {
    const nodes = await executeSql(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='graph_nodes'`
    )
    if (nodes.rows.length > 0) {
      const cols = await executeSql(`PRAGMA table_info(graph_nodes)`)
      const names = new Set(
        cols.rows.map((c: { name?: string }) => c.name).filter(Boolean) as string[]
      )
      if (!names.has('name_normalized')) {
        logger.info('[MigrationService] graph_nodes 缺 name_normalized，ADD COLUMN 回填...')
        await executeSql(
          `ALTER TABLE graph_nodes ADD COLUMN name_normalized TEXT NOT NULL DEFAULT ''`
        )
        await executeSql(
          `UPDATE graph_nodes SET name_normalized = lower(trim(name)) WHERE name_normalized = ''`
        )
      }
      if (!names.has('discriminator')) {
        // 唯一索引要带上区分信息；必须先补列再 DROP/CREATE，否则建索引会因缺列失败
        logger.info('[MigrationService] graph_nodes 缺 discriminator，ADD COLUMN...')
        await executeSql(
          `ALTER TABLE graph_nodes ADD COLUMN discriminator TEXT NOT NULL DEFAULT ''`
        )
      }
    }

    const nodesAfter = await executeSql(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='graph_nodes'`
    )
    if (nodesAfter.rows.length === 0) {
      logger.info('[MigrationService] 创建缺失的 graph_nodes 表...')
      await executeSql(GRAPH_NODES_CREATE_SQL)
    }
    const aliases = await executeSql(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='graph_node_aliases'`
    )
    if (aliases.rows.length === 0) {
      logger.info('[MigrationService] 创建缺失的 graph_node_aliases 表...')
      await executeSql(GRAPH_NODE_ALIASES_CREATE_SQL)
    }
    const edges = await executeSql(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='graph_edges'`
    )
    if (edges.rows.length === 0) {
      logger.info('[MigrationService] 创建缺失的 graph_edges 表...')
      await executeSql(GRAPH_EDGES_CREATE_SQL)
    }
    for (const ddl of GRAPH_INDEXES_SQL) {
      await executeSql(ddl)
    }
    for (const ddl of GRAPH_PURGE_SOFT_DELETED_SQL) {
      await executeSql(ddl)
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    logger.warn('[MigrationService] graph 表检查失败（非阻塞）:', message)
  }
}

export async function ensureEmbedLedgerTable(executeSql: MigrationSqlExecutor): Promise<void> {
  try {
    const table = await executeSql(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='embed_ledger'`
    )
    if (table.rows.length === 0) {
      logger.info('[MigrationService] 创建缺失的 embed_ledger 表...')
      await executeSql(EMBED_LEDGER_CREATE_SQL)
    }
    for (const ddl of EMBED_LEDGER_INDEXES_SQL) {
      await executeSql(ddl)
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    logger.warn('[MigrationService] embed_ledger 表检查失败（非阻塞）:', message)
  }
}

/** 将 diary_embed_jobs 幂等迁入 embed_ledger 后整表退休。 */
export async function retireDiaryEmbedJobsTable(executeSql: MigrationSqlExecutor): Promise<void> {
  try {
    const table = await executeSql(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='diary_embed_jobs'`
    )
    if (table.rows.length === 0) return
    logger.info('[MigrationService] 将 diary_embed_jobs 迁入 embed_ledger 后删除该表...')
    await ensureEmbedLedgerTable(executeSql)
    await executeSql(MIGRATE_DIARY_EMBED_JOBS_INTO_LEDGER_SQL)
    await executeSql(`DROP TABLE IF EXISTS diary_embed_jobs`)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    logger.warn('[MigrationService] diary_embed_jobs 退休失败（非阻塞）:', message)
  }
}

/**
 * 按 agent-schema-compat 清单补齐旧库缺失列（squash 迁移后未执行的增量变更）。
 */
export async function ensureAgentSchemaColumns(executeSql: MigrationSqlExecutor): Promise<void> {
  const columnsByTable = new Map<string, Set<string>>()

  for (const patch of AGENT_DB_COLUMN_PATCHES) {
    let names = columnsByTable.get(patch.table)
    if (!names) {
      const tableInfo = await executeSql(`PRAGMA table_info(${patch.table})`)
      if (tableInfo.rows.length === 0) continue
      names = new Set(
        tableInfo.rows.map((c: { name?: string }) => c.name).filter(Boolean) as string[]
      )
      columnsByTable.set(patch.table, names)
    }

    if (names.has(patch.column)) continue

    try {
      logger.info(`[MigrationService] 添加 ${patch.table}.${patch.column} 列...`)
      await executeSql(patch.ddl)
      names.add(patch.column)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      logger.warn(
        `[MigrationService] ${patch.table}.${patch.column} 列检查失败（非阻塞）:`,
        message
      )
    }
  }
}

/**
 * 旧版库可能缺 order_index 或全为 0；
 * 按 session 内 created_at 顺序回填，保证导入后查询可用。
 */
export async function backfillAgentMessagesOrderIndex(
  executeSql: MigrationSqlExecutor
): Promise<void> {
  try {
    const tableInfo = await executeSql(`PRAGMA table_info(agent_messages)`)
    if (tableInfo.rows.length === 0) return
    const hasOrderIndex = tableInfo.rows.some((c: { name?: string }) => c.name === 'order_index')
    if (!hasOrderIndex) return

    await executeSql(`
        WITH ordered AS (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY session_id
              ORDER BY created_at, id
            ) - 1 AS new_idx
          FROM agent_messages
        )
        UPDATE agent_messages
        SET order_index = (
          SELECT new_idx FROM ordered WHERE ordered.id = agent_messages.id
        )
        WHERE order_index IS NULL
           OR order_index != (
             SELECT new_idx FROM ordered WHERE ordered.id = agent_messages.id
           )
      `)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    logger.warn('[MigrationService] agent_messages.order_index 回填失败（非阻塞）:', message)
  }
}

export async function ensureCompressionSnapshotsCompatibility(
  executeSql: MigrationSqlExecutor
): Promise<void> {
  try {
    const tableInfo = await executeSql(`PRAGMA table_info(compression_snapshots)`)
    const cols = tableInfo.rows
    const sessionIdCol = cols.find((c: any) => c.name === 'session_id')
    if (sessionIdCol && (sessionIdCol.type as string).toUpperCase() === 'INTEGER') {
      logger.info('[MigrationService] 重建 compression_snapshots（INTEGER→TEXT）...')
      await executeSql(`ALTER TABLE compression_snapshots RENAME TO _comp_snap_old`)
      await executeSql(`
          CREATE TABLE compression_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            session_id TEXT NOT NULL,
            summary_text TEXT NOT NULL,
            covered_up_to_message_id TEXT NOT NULL,
            message_count INTEGER NOT NULL,
            token_count INTEGER,
            created_at INTEGER NOT NULL
          )
        `)
      await executeSql(`
          INSERT INTO compression_snapshots
            (id, session_id, summary_text, covered_up_to_message_id, message_count, created_at)
          SELECT id, CAST(session_id AS TEXT), summary_text,
                 CAST(covered_up_to_message_id AS TEXT), message_count, created_at
          FROM _comp_snap_old
        `)
      await executeSql(`DROP TABLE _comp_snap_old`)
      logger.info('[MigrationService] compression_snapshots 重建完成。')
    }
  } catch (e: any) {
    logger.warn('[MigrationService] compression_snapshots 兼容性检查失败（非阻塞）:', e.message)
  }
}

export async function ensureCompatSchema(
  executeSql: MigrationSqlExecutor,
  storageRoot?: string
): Promise<void> {
  await ensureSystemSettingsTable(executeSql)
  await ensureMemoryEmbeddingsTable(executeSql)
  await ensureGraphTables(executeSql)
  await ensureEmbedLedgerTable(executeSql)
  await retireDiaryEmbedJobsTable(executeSql)
  await ensureAgentSchemaColumns(executeSql)
  await ensureMemoryEmbeddingsVaultIndex(executeSql)
  await backfillMemoryEmbeddingsVaultNameColumn(executeSql)
  await migrateVaultNameToVaultId(executeSql, storageRoot)
  await migrateSummariesAndAssistantsVault(executeSql)
  await backfillAgentMessagesOrderIndex(executeSql)
}
