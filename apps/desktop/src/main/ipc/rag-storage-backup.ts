import i18n from 'i18next'
import { memoryEmbeddingsTable } from '@baishou/database-desktop'
import { logger, mapMigrationBackupRow } from '@baishou/shared'
import { sql } from 'drizzle-orm'
import { getAppDb } from '../db'
import {
  BACKUP_TABLE,
  ROLLBACK_TABLE,
  SAFETY_BACKUP_TABLE,
  isSafetyBackupTableName,
  parseSafetyBackupCreatedAt,
  withEmbeddingWriteLock
} from './rag-storage.util'

export async function backupBeforeClear(): Promise<number> {
  const db = getAppDb()

  // 检查是否有数据需要备份
  const countRows = await db.all(sql`SELECT count(*) as c FROM memory_embeddings`)
  const count = Number((countRows[0] as any)?.c ?? 0)
  if (count === 0) return 0

  // 创建安全备份表（带时间戳区分）
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupTableName = `${SAFETY_BACKUP_TABLE}_${timestamp}`

  await db.run(
    sql.raw(`
      CREATE TABLE IF NOT EXISTS ${backupTableName} AS
      SELECT embedding_id, source_type, source_id, group_id, chunk_index, chunk_text,
             metadata_json, embedding, dimension, model_id, created_at, source_created_at
      FROM memory_embeddings
    `)
  )

  logger.info(`[RAG] 安全备份完成: ${count} 条记录 -> ${backupTableName}`)
  return count
}

export async function listSafetyBackups(): Promise<
  Array<{ name: string; count: number; createdAt: string }>
> {
  const db = getAppDb()
  const tables = await db.all(
    sql`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ${SAFETY_BACKUP_TABLE + '%'}`
  )

  const result: Array<{ name: string; count: number; createdAt: string }> = []
  for (const row of tables) {
    const tableName = (row as any).name
    const countRows = await db.all(sql.raw(`SELECT count(*) as c FROM ${tableName}`))
    const count = Number((countRows[0] as any)?.c ?? 0)
    // 从表名提取时间戳
    result.push({
      name: tableName,
      count,
      createdAt: parseSafetyBackupCreatedAt(tableName)
    })
  }

  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function restoreFromSafetyBackup(backupTableName: string): Promise<number> {
  const db = getAppDb()

  // 验证备份表存在
  const checkTable = await db.all(
    sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${backupTableName}`
  )
  if (checkTable.length === 0) {
    throw new Error(`备份表 ${backupTableName} 不存在`)
  }

  // 清空当前数据
  await db.delete(memoryEmbeddingsTable)

  // 从备份恢复
  await db.run(
    sql.raw(`
      INSERT INTO memory_embeddings (embedding_id, source_type, source_id, group_id, chunk_index, 
                                      chunk_text, metadata_json, embedding, dimension, model_id, 
                                      created_at, source_created_at)
      SELECT embedding_id, source_type, source_id, group_id, chunk_index, 
             chunk_text, metadata_json, embedding, dimension, model_id, 
             created_at, source_created_at
      FROM ${backupTableName}
    `)
  )

  const countRows = await db.all(sql`SELECT count(*) as c FROM memory_embeddings`)
  const count = Number((countRows[0] as any)?.c ?? 0)
  logger.info(`[RAG] 从备份恢复完成: ${count} 条记录`)
  return count
}

export async function deleteSafetyBackup(backupTableName: string): Promise<void> {
  const db = getAppDb()
  // 防止 SQL 注入：只允许删除符合命名规则的表
  if (!isSafetyBackupTableName(backupTableName)) {
    throw new Error(i18n.t('auto.apps.desktop.src.main.ipc.rag.storage.L208', '无效的备份表名'))
  }
  await db.run(sql.raw(`DROP TABLE IF EXISTS ${backupTableName}`))
}

export async function exportEmbeddings(): Promise<any[]> {
  const db = getAppDb()
  const rows = await db.all(sql`
      SELECT embedding_id, source_type, source_id, group_id, chunk_index, chunk_text,
             metadata_json, dimension, model_id, created_at, source_created_at
      FROM memory_embeddings
      ORDER BY created_at DESC
    `)

  return rows.map((r: any) => ({
    embeddingId: r.embedding_id,
    sourceType: r.source_type,
    sourceId: r.source_id,
    groupId: r.group_id,
    chunkIndex: r.chunk_index,
    chunkText: r.chunk_text,
    metadataJson: r.metadata_json,
    dimension: r.dimension,
    modelId: r.model_id,
    createdAt: r.created_at,
    sourceCreatedAt: r.source_created_at
  }))
}

export async function hasMigrationBackupTable(): Promise<boolean> {
  const db = getAppDb()
  const checkTable = await db.all(
    sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${BACKUP_TABLE}`
  )
  return checkTable.length > 0
}

export async function hasMigrationRollbackTable(): Promise<boolean> {
  const db = getAppDb()
  const checkTable = await db.all(
    sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${ROLLBACK_TABLE}`
  )
  return checkTable.length > 0
}

export async function hasPendingMigration(): Promise<boolean> {
  if (!(await hasMigrationBackupTable())) return false

  const db = getAppDb()
  const countRows = await db.all(
    sql.raw(`SELECT count(*) as c FROM ${BACKUP_TABLE} WHERE is_migrated = 0`)
  )
  return Number((countRows[0] as any)?.c ?? 0) > 0
}

export async function createRollbackSnapshot(): Promise<number> {
  const db = getAppDb()
  const countRows = await db.all(sql`SELECT count(*) as c FROM memory_embeddings`)
  const count = Number((countRows[0] as any)?.c ?? 0)
  if (count === 0) return 0

  await db.run(sql.raw(`DROP TABLE IF EXISTS ${ROLLBACK_TABLE}`))
  await db.run(
    sql.raw(`
      CREATE TABLE ${ROLLBACK_TABLE} AS
      SELECT embedding_id, source_type, source_id, group_id, vault_id, chunk_index, chunk_text,
             metadata_json, embedding, dimension, model_id, created_at, source_created_at
      FROM memory_embeddings
    `)
  )
  logger.info(`[RAG] Migration rollback snapshot created: ${count} rows`)
  return count
}

export async function restoreRollbackSnapshot(): Promise<number> {
  const db = getAppDb()
  const checkTable = await db.all(
    sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${ROLLBACK_TABLE}`
  )
  if (checkTable.length === 0) {
    throw new Error(`Rollback snapshot table ${ROLLBACK_TABLE} does not exist`)
  }

  await db.delete(memoryEmbeddingsTable)
  await db.run(
    sql.raw(`
      INSERT INTO memory_embeddings (embedding_id, source_type, source_id, group_id, vault_id, chunk_index,
                                     chunk_text, metadata_json, embedding, dimension, model_id,
                                     created_at, source_created_at)
      SELECT embedding_id, source_type, source_id, group_id, vault_id, chunk_index, chunk_text,
             metadata_json, embedding, dimension, model_id, created_at, source_created_at
      FROM ${ROLLBACK_TABLE}
    `)
  )

  const restoredRows = await db.all(sql`SELECT count(*) as c FROM memory_embeddings`)
  const count = Number((restoredRows[0] as any)?.c ?? 0)
  logger.info(`[RAG] Migration rollback snapshot restored: ${count} rows`)
  return count
}

export async function dropRollbackSnapshot(): Promise<void> {
  const db = getAppDb()
  await db.run(sql.raw(`DROP TABLE IF EXISTS ${ROLLBACK_TABLE}`))
}

export async function hasRollbackSnapshot(): Promise<boolean> {
  const db = getAppDb()
  const checkTable = await db.all(
    sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${ROLLBACK_TABLE}`
  )
  if (checkTable.length === 0) return false

  const countRows = await db.all(sql.raw(`SELECT count(*) as c FROM ${ROLLBACK_TABLE}`))
  return Number((countRows[0] as any)?.c ?? 0) > 0
}

export async function createMigrationBackup(): Promise<number> {
  return withEmbeddingWriteLock(async () => {
    const db = getAppDb()
    await db.run(sql.raw(`DROP TABLE IF EXISTS ${BACKUP_TABLE}`))
    await db.run(
      sql.raw(`
      CREATE TABLE ${BACKUP_TABLE} AS
      SELECT embedding_id, source_type, source_id, group_id, vault_id, chunk_index, chunk_text,
             metadata_json, source_created_at, 0 as is_migrated
      FROM memory_embeddings
    `)
    )
    await db.run(
      sql.raw(`CREATE INDEX IF NOT EXISTS idx_backup_migrated ON ${BACKUP_TABLE}(is_migrated)`)
    )
    const countRows = await db.all(sql.raw(`SELECT count(*) as c FROM ${BACKUP_TABLE}`))
    return Number((countRows[0] as any)?.c ?? 0)
  })
}

export async function dropMigrationBackup(): Promise<void> {
  await withEmbeddingWriteLock(async () => {
    const db = getAppDb()
    await db.run(sql.raw(`DROP TABLE IF EXISTS ${BACKUP_TABLE}`))
  })
}

export async function getUnmigratedCount(): Promise<number> {
  try {
    const db = getAppDb()
    const countRows = await db.all(
      sql.raw(`SELECT count(*) as c FROM ${BACKUP_TABLE} WHERE is_migrated = 0`)
    )
    return Number((countRows[0] as any)?.c ?? 0)
  } catch {
    return 0
  }
}

export async function getUnmigratedBackupChunks(): Promise<any[]> {
  try {
    const db = getAppDb()
    const rows = await db.all(
      sql.raw(`
        SELECT embedding_id, source_type as sourceType, source_id as sourceId, group_id as groupId,
               vault_id as vaultId, chunk_index as chunkIndex, chunk_text as chunkText,
               metadata_json as metadataJson, source_created_at as sourceCreatedAt
        FROM ${BACKUP_TABLE}
        WHERE is_migrated = 0
        LIMIT 50
      `)
    )
    return (rows as Record<string, unknown>[]).map(mapMigrationBackupRow)
  } catch {
    return []
  }
}

export async function markBackupChunkMigrated(embeddingId: string): Promise<void> {
  await withEmbeddingWriteLock(async () => {
    if (!(await hasMigrationBackupTable())) {
      throw new Error(`Migration backup table ${BACKUP_TABLE} is missing`)
    }
    const db = getAppDb()
    await db.run(
      sql`UPDATE ${sql.raw(BACKUP_TABLE)} SET is_migrated = 1 WHERE embedding_id = ${embeddingId}`
    )
  })
}
