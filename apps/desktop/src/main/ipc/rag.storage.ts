import { IEmbeddingStorage } from '@baishou/ai/src/rag/embedding.types';
import { getAppDb } from '../db';
import { memoryEmbeddingsTable } from '@baishou/database';
import { eq, and, sql } from 'drizzle-orm';

/** 嵌入迁移备份表名 */
const BACKUP_TABLE = 'memory_embeddings_backup';

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
