import {
  logger,
  mapMigrationBackupRow,
  type EmbeddingSnapshotMeta,
  type ISqlExecutor
} from '@baishou/shared'
import {
  HYBRID_SEARCH_BACKUP_TABLE,
  HYBRID_SEARCH_ROLLBACK_TABLE,
  HYBRID_SEARCH_TABLE
} from './hybrid-search.repository.constants'

export class HybridSearchMigrationStore {
  constructor(private readonly db: ISqlExecutor) {}

  async hasPendingMigration(): Promise<boolean> {
    if (!(await this.hasMigrationBackupTable())) return false

    const countRow = await this.db.execute(
      `SELECT count(*) as c FROM ${HYBRID_SEARCH_BACKUP_TABLE} WHERE is_migrated = 0`
    )
    return Number(countRow.rows[0]?.c ?? 0) > 0
  }

  async hasMigrationBackupTable(): Promise<boolean> {
    const checkTable = await this.db.execute({
      sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      args: [HYBRID_SEARCH_BACKUP_TABLE]
    })
    return checkTable.rows.length > 0
  }

  async hasMigrationRollbackTable(): Promise<boolean> {
    const checkTable = await this.db.execute({
      sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      args: [HYBRID_SEARCH_ROLLBACK_TABLE]
    })
    return checkTable.rows.length > 0
  }

  async countHeterogeneousEmbeddings(currentModelId: string): Promise<number> {
    const checkTable = await this.db.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${HYBRID_SEARCH_TABLE}'`
    )
    if (checkTable.rows.length === 0) return 0

    const countRow = await this.db.execute({
      sql: `SELECT count(*) as c FROM ${HYBRID_SEARCH_TABLE} WHERE model_id != ?`,
      args: [currentModelId]
    })
    return Number(countRow.rows[0]?.c ?? 0)
  }

  async createMigrationBackup(): Promise<number> {
    await this.db.execute(`DROP TABLE IF EXISTS ${HYBRID_SEARCH_BACKUP_TABLE}`)
    await this.db.execute(`
      CREATE TABLE ${HYBRID_SEARCH_BACKUP_TABLE} AS
      SELECT embedding_id, source_type, source_id, group_id, vault_id, chunk_index, chunk_text,
             metadata_json, source_created_at, 0 as is_migrated
      FROM ${HYBRID_SEARCH_TABLE}
    `)
    await this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_mig_backup_migrated ON ${HYBRID_SEARCH_BACKUP_TABLE}(is_migrated)`
    )
    const count = await this.db.execute(`SELECT count(*) as c FROM ${HYBRID_SEARCH_BACKUP_TABLE}`)
    return Number(count.rows[0]?.c ?? 0)
  }

  async dropMigrationBackup(): Promise<void> {
    await this.db.execute(`DROP TABLE IF EXISTS ${HYBRID_SEARCH_BACKUP_TABLE}`)
  }

  async getUnmigratedCount(): Promise<number> {
    try {
      const countRow = await this.db.execute(
        `SELECT count(*) as c FROM ${HYBRID_SEARCH_BACKUP_TABLE} WHERE is_migrated = 0`
      )
      return Number(countRow.rows[0]?.c ?? 0)
    } catch {
      return 0
    }
  }

  async getUnmigratedBackupChunks(): Promise<any[]> {
    try {
      const res = await this.db.execute(`
        SELECT embedding_id, source_type as sourceType, source_id as sourceId, group_id as groupId,
               vault_id as vaultId, chunk_index as chunkIndex, chunk_text as chunkText,
               metadata_json as metadataJson, source_created_at as sourceCreatedAt
        FROM ${HYBRID_SEARCH_BACKUP_TABLE}
        WHERE is_migrated = 0
        LIMIT 50
      `)
      return Array.from(res.rows).map((row) =>
        mapMigrationBackupRow(row as Record<string, unknown>)
      )
    } catch {
      return []
    }
  }

  async markBackupChunkMigrated(embeddingId: string): Promise<void> {
    await this.db.execute({
      sql: `UPDATE ${HYBRID_SEARCH_BACKUP_TABLE} SET is_migrated = 1 WHERE embedding_id = ?`,
      args: [embeddingId]
    })
  }

  async verifyMigrationComplete(modelId: string): Promise<[boolean, boolean]> {
    const pending = await this.hasPendingMigration()
    const mismatchedCount = await this.countHeterogeneousEmbeddings(modelId)
    return [!pending, mismatchedCount === 0]
  }

  async getCurrentEmbeddingMeta(): Promise<EmbeddingSnapshotMeta | null> {
    const countRow = await this.db.execute(`SELECT count(*) as c FROM ${HYBRID_SEARCH_TABLE}`)
    const count = Number(countRow.rows[0]?.c ?? 0)
    if (count === 0) return null
    const metaRow = await this.db.execute(`
      SELECT model_id as modelId, dimension, count(*) as c FROM ${HYBRID_SEARCH_TABLE}
      GROUP BY model_id, dimension ORDER BY c DESC LIMIT 1
    `)
    const row = metaRow.rows[0]
    if (!row?.modelId) return null
    return { modelId: String(row.modelId), dimension: Number(row.dimension ?? 0), count }
  }

  async createRollbackSnapshot(): Promise<number> {
    const countRow = await this.db.execute(`SELECT count(*) as c FROM ${HYBRID_SEARCH_TABLE}`)
    const count = Number(countRow.rows[0]?.c ?? 0)
    if (count === 0) return 0
    await this.db.execute(`DROP TABLE IF EXISTS ${HYBRID_SEARCH_ROLLBACK_TABLE}`)
    await this.db.execute(`
      CREATE TABLE ${HYBRID_SEARCH_ROLLBACK_TABLE} AS
      SELECT embedding_id, source_type, source_id, group_id, vault_id, chunk_index, chunk_text,
             metadata_json, embedding, dimension, model_id, created_at, source_created_at FROM ${HYBRID_SEARCH_TABLE}
    `)
    logger.info(`[RAG] Migration rollback snapshot created: ${count} rows`)
    return count
  }

  async restoreRollbackSnapshot(): Promise<number> {
    const checkTable = await this.db.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${HYBRID_SEARCH_ROLLBACK_TABLE}'`
    )
    if (checkTable.rows.length === 0)
      throw new Error(`Rollback snapshot table ${HYBRID_SEARCH_ROLLBACK_TABLE} does not exist`)
    await this.db.execute(`DELETE FROM ${HYBRID_SEARCH_TABLE}`)
    await this.db.execute(`
      INSERT INTO ${HYBRID_SEARCH_TABLE} (embedding_id, source_type, source_id, group_id, vault_id, chunk_index,
                                          chunk_text, metadata_json, embedding, dimension, model_id, created_at, source_created_at)
      SELECT embedding_id, source_type, source_id, group_id, vault_id, chunk_index, chunk_text,
             metadata_json, embedding, dimension, model_id, created_at, source_created_at FROM ${HYBRID_SEARCH_ROLLBACK_TABLE}
    `)
    const restored = await this.db.execute(`SELECT count(*) as c FROM ${HYBRID_SEARCH_TABLE}`)
    return Number(restored.rows[0]?.c ?? 0)
  }

  async dropRollbackSnapshot(): Promise<void> {
    await this.db.execute(`DROP TABLE IF EXISTS ${HYBRID_SEARCH_ROLLBACK_TABLE}`)
  }

  async hasRollbackSnapshot(): Promise<boolean> {
    const checkTable = await this.db.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${HYBRID_SEARCH_ROLLBACK_TABLE}'`
    )
    if (checkTable.rows.length === 0) return false
    const countRow = await this.db.execute(
      `SELECT count(*) as c FROM ${HYBRID_SEARCH_ROLLBACK_TABLE}`
    )
    return Number(countRow.rows[0]?.c ?? 0) > 0
  }
}
