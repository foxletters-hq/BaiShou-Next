import { IEmbeddingStorage } from '@baishou/ai/src/rag/embedding.types';
import { getAppDb } from '../db';
import { memoryEmbeddingsTable } from '@baishou/database';
import { eq, and, sql } from 'drizzle-orm';

export class DesktopEmbeddingStorage implements IEmbeddingStorage {
  async initVectorIndex(dimension: number): Promise<void> {
    // Better-sqlite3 with Drizzle handles this generically via migrations.
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

  // --- 迁移 Dummy Implementations (To satisfy Interface without over-engineering) ---
  async hasPendingMigration(): Promise<boolean> { return false; }
  async countHeterogeneousEmbeddings(currentModelId: string): Promise<number> { return 0; }
  async createMigrationBackup(): Promise<number> { return 0; }
  async dropMigrationBackup(): Promise<void> {}
  async clearAndReinitEmbeddings(dimension: number): Promise<void> { await this.clearEmbeddings(); }
  async getUnmigratedCount(): Promise<number> { return 0; }
  async getUnmigratedBackupChunks(): Promise<any[]> { return []; }
  async markBackupChunkMigrated(embeddingId: string): Promise<void> {}
  async verifyMigrationComplete(modelId: string): Promise<[boolean, boolean]> { return [true, true]; }
}
