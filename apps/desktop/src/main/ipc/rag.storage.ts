import { IEmbeddingStorage } from '@baishou/ai/src/rag/embedding.types';
import { getAppDb } from '../db';
import { memoryEmbeddingsTable } from '@baishou/database';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '@baishou/shared';

/** 嵌入迁移备份表名 */
const BACKUP_TABLE = 'memory_embeddings_backup';
/** 清空前自动备份表名 */
const SAFETY_BACKUP_TABLE = 'memory_embeddings_safety_backup';

export class DesktopEmbeddingStorage implements IEmbeddingStorage {
  async initVectorIndex(_dimension: number): Promise<void> {
    // Drizzle 迁移已管理 memory_embeddings 表结构，此处无需额外操作
  }

  async insertEmbedding(params: {
    id: string;
    sourceType: string;
    sourceId: string;
    groupId: string;
    chunkIndex: number;
    chunkText: string;
    metadataJson?: string;
    embedding: number[];
    modelId: string;
    sourceCreatedAt?: number;
  }): Promise<void> {
    const db = getAppDb();
    const vectorBuffer = Buffer.from(new Float32Array(params.embedding).buffer);

    await db.insert(memoryEmbeddingsTable).values({
      embeddingId: params.id,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      groupId: params.groupId,
      chunkIndex: params.chunkIndex,
      chunkText: params.chunkText,
      metadataJson: params.metadataJson || '{}',
      embedding: vectorBuffer,
      dimension: params.embedding.length,
      modelId: params.modelId,
      createdAt: new Date(),
      sourceCreatedAt: params.sourceCreatedAt ? new Date(params.sourceCreatedAt) : new Date(),
    }).onConflictDoUpdate({
      target: [memoryEmbeddingsTable.embeddingId],
      set: {
        chunkText: params.chunkText,
        embedding: vectorBuffer,
        dimension: params.embedding.length,
        modelId: params.modelId,
        metadataJson: params.metadataJson || '{}',
      }
    });
  }

  async deleteEmbeddingsBySource(sourceType: string, sourceId: string): Promise<void> {
    const db = getAppDb();
    await db.delete(memoryEmbeddingsTable).where(
      and(
        eq(memoryEmbeddingsTable.sourceType, sourceType),
        eq(memoryEmbeddingsTable.sourceId, sourceId)
      )
    );
  }

  async clearEmbeddings(): Promise<void> {
    const db = getAppDb();
    await db.delete(memoryEmbeddingsTable);
  }

  // ── 清空前自动备份 ──────────────────────────

  /**
   * 清空记忆前自动创建安全备份
   * @returns 备份的记录数
   */
  async backupBeforeClear(): Promise<number> {
    const db = getAppDb();
    
    // 检查是否有数据需要备份
    const countRows = await db.all(sql`SELECT count(*) as c FROM memory_embeddings`);
    const count = Number((countRows[0] as any)?.c ?? 0);
    if (count === 0) return 0;

    // 创建安全备份表（带时间戳区分）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupTableName = `${SAFETY_BACKUP_TABLE}_${timestamp}`;
    
    await db.run(sql.raw(`
      CREATE TABLE IF NOT EXISTS ${backupTableName} AS
      SELECT embedding_id, source_type, source_id, group_id, chunk_index, chunk_text,
             metadata_json, embedding, dimension, model_id, created_at, source_created_at
      FROM memory_embeddings
    `));
    
    logger.info(`[RAG] 安全备份完成: ${count} 条记录 -> ${backupTableName}`);
    return count;
  }

  /**
   * 获取所有安全备份表列表
   */
  async listSafetyBackups(): Promise<Array<{ name: string; count: number; createdAt: string }>> {
    const db = getAppDb();
    const tables = await db.all(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ${SAFETY_BACKUP_TABLE + '%'}`
    );
    
    const result: Array<{ name: string; count: number; createdAt: string }> = [];
    for (const row of tables) {
      const tableName = (row as any).name;
      const countRows = await db.all(sql.raw(`SELECT count(*) as c FROM ${tableName}`));
      const count = Number((countRows[0] as any)?.c ?? 0);
      // 从表名提取时间戳
      const match = tableName.match(new RegExp(`${SAFETY_BACKUP_TABLE}-(.+)`));
      const createdAt = match ? match[1].replace(/-/g, (m: string, offset: number) => {
        if (offset === 10) return 'T';
        if (offset === 13 || offset === 16) return ':';
        if (offset === 19) return '.';
        return m;
      }) : 'unknown';
      result.push({ name: tableName, count, createdAt });
    }
    
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * 从安全备份恢复数据
   */
  async restoreFromSafetyBackup(backupTableName: string): Promise<number> {
    const db = getAppDb();
    
    // 验证备份表存在
    const checkTable = await db.all(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${backupTableName}`
    );
    if (checkTable.length === 0) {
      throw new Error(`备份表 ${backupTableName} 不存在`);
    }

    // 清空当前数据
    await db.delete(memoryEmbeddingsTable);
    
    // 从备份恢复
    await db.run(sql.raw(`
      INSERT INTO memory_embeddings (embedding_id, source_type, source_id, group_id, chunk_index, 
                                      chunk_text, metadata_json, embedding, dimension, model_id, 
                                      created_at, source_created_at)
      SELECT embedding_id, source_type, source_id, group_id, chunk_index, 
             chunk_text, metadata_json, embedding, dimension, model_id, 
             created_at, source_created_at
      FROM ${backupTableName}
    `));
    
    const countRows = await db.all(sql`SELECT count(*) as c FROM memory_embeddings`);
    const count = Number((countRows[0] as any)?.c ?? 0);
    logger.info(`[RAG] 从备份恢复完成: ${count} 条记录`);
    return count;
  }

  /**
   * 删除指定安全备份表
   */
  async deleteSafetyBackup(backupTableName: string): Promise<void> {
    const db = getAppDb();
    // 防止 SQL 注入：只允许删除符合命名规则的表
    if (!backupTableName.startsWith(SAFETY_BACKUP_TABLE)) {
      throw new Error('无效的备份表名');
    }
    await db.run(sql.raw(`DROP TABLE IF EXISTS ${backupTableName}`));
  }

  // ── 导出/导入 ──────────────────────────

  /**
   * 导出所有 embedding 数据为 JSON 格式（不含向量 blob）
   */
  async exportEmbeddings(): Promise<any[]> {
    const db = getAppDb();
    const rows = await db.all(sql`
      SELECT embedding_id, source_type, source_id, group_id, chunk_index, chunk_text,
             metadata_json, dimension, model_id, created_at, source_created_at
      FROM memory_embeddings
      ORDER BY created_at DESC
    `);
    
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
    }));
  }

  // ── 迁移实现（对标 SqliteHybridSearchRepository） ──────────────────

  async hasPendingMigration(): Promise<boolean> {
    const db = getAppDb();
    const checkTable = await db.all(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${BACKUP_TABLE}`
    );
    if (checkTable.length === 0) return false;

    const countRows = await db.all(
      sql.raw(`SELECT count(*) as c FROM ${BACKUP_TABLE} WHERE is_migrated = 0`)
    );
    return Number((countRows[0] as any)?.c ?? 0) > 0;
  }

  async countHeterogeneousEmbeddings(currentModelId: string): Promise<number> {
    const db = getAppDb();
    const checkTable = await db.all(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name='memory_embeddings'`
    );
    if (checkTable.length === 0) return 0;

    const countRows = await db.all(
      sql`SELECT count(*) as c FROM memory_embeddings WHERE model_id != ${currentModelId}`
    );
    return Number((countRows[0] as any)?.c ?? 0);
  }

  async createMigrationBackup(): Promise<number> {
    const db = getAppDb();
    await db.run(sql.raw(`DROP TABLE IF EXISTS ${BACKUP_TABLE}`));
    await db.run(sql.raw(`
      CREATE TABLE ${BACKUP_TABLE} AS
      SELECT id, source_type, source_id, group_id, chunk_index, chunk_text,
             metadata_json, source_created_at, 0 as is_migrated
      FROM memory_embeddings
    `));
    await db.run(
      sql.raw(`CREATE INDEX IF NOT EXISTS idx_backup_migrated ON ${BACKUP_TABLE}(is_migrated)`)
    );
    const countRows = await db.all(sql.raw(`SELECT count(*) as c FROM ${BACKUP_TABLE}`));
    return Number((countRows[0] as any)?.c ?? 0);
  }

  async dropMigrationBackup(): Promise<void> {
    const db = getAppDb();
    await db.run(sql.raw(`DROP TABLE IF EXISTS ${BACKUP_TABLE}`));
  }

  async clearAndReinitEmbeddings(_dimension: number): Promise<void> {
    await this.clearEmbeddings();
  }

  async getUnmigratedCount(): Promise<number> {
    try {
      const db = getAppDb();
      const countRows = await db.all(
        sql.raw(`SELECT count(*) as c FROM ${BACKUP_TABLE} WHERE is_migrated = 0`)
      );
      return Number((countRows[0] as any)?.c ?? 0);
    } catch {
      return 0;
    }
  }

  async getUnmigratedBackupChunks(): Promise<any[]> {
    try {
      const db = getAppDb();
      const rows = await db.all(sql.raw(`
        SELECT id, source_type as sourceType, source_id as sourceId, group_id as groupId,
               chunk_index as chunkIndex, chunk_text as chunkText, metadata_json as metadataJson,
               source_created_at as sourceCreatedAt
        FROM ${BACKUP_TABLE}
        WHERE is_migrated = 0
        LIMIT 50
      `));
      return rows as any[];
    } catch {
      return [];
    }
  }

  async markBackupChunkMigrated(embeddingId: string): Promise<void> {
    const db = getAppDb();
    await db.run(
      sql`UPDATE ${sql.raw(BACKUP_TABLE)} SET is_migrated = 1 WHERE id = ${embeddingId}`
    );
  }

  async verifyMigrationComplete(modelId: string): Promise<[boolean, boolean]> {
    const pending = await this.hasPendingMigration();
    const mismatchedCount = await this.countHeterogeneousEmbeddings(modelId);
    return [!pending, mismatchedCount === 0];
  }
}
