import { Client } from '@libsql/client';
import { IHybridSearchStorage, ISearchResult, IEmbeddingStorage } from '@baishou/ai';

export class SqliteHybridSearchRepository implements IHybridSearchStorage, IEmbeddingStorage {
  private readonly BACKUP_TABLE = 'agent_embeddings_backup';

  constructor(private readonly db: Client) {
  }

  // --- IEmbeddingStorage 核心 ---

  public async initVectorIndex(dimension: number): Promise<void> {
    await this.initVectorTables(dimension, false);
  }

  public async initVectorTables(dimension: number, forceRebuild = false) {
    if (forceRebuild) {
      await this.db.execute(`DROP TABLE IF EXISTS agent_embeddings;`);
    }

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS agent_embeddings (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        metadata_json TEXT DEFAULT '{}',
        embedding F32_BLOB(${dimension}) NOT NULL,
        model_id TEXT NOT NULL,
        source_created_at INTEGER
      );
    `);

    if (dimension > 0) {
      try {
        await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_agent_embeddings_vector ON agent_embeddings (libsql_vector_idx(embedding));`);
      } catch (e) {
        console.warn('Vector index creation unsupported or already exists:', e);
      }
    }
  }

  public async insertEmbedding(params: {
        id: string; sourceType: string; sourceId: string; groupId: string; 
        chunkIndex: number; chunkText: string; metadataJson?: string; 
        embedding: number[]; modelId: string; sourceCreatedAt?: number;
    }): Promise<void> {
        // Build raw binary for LibSQL vector (actually LibSQL can accept standard arrays for vectors, but passing Float32Array JSON string is safe)
        const vectorStr = `[${params.embedding.join(',')}]`;
        await this.db.execute({
          sql: `
          INSERT OR REPLACE INTO agent_embeddings 
          (id, source_type, source_id, group_id, chunk_index, chunk_text, metadata_json, embedding, model_id, source_created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, vector(?), ?, ?)
          `,
          args: [params.id, params.sourceType, params.sourceId, params.groupId, params.chunkIndex, 
            params.chunkText, params.metadataJson || '{}', vectorStr, params.modelId, params.sourceCreatedAt || Date.now()]
        });
  }

  public async deleteEmbeddingsBySource(sourceType: string, sourceId: string): Promise<void> {
    await this.db.execute({
      sql: `DELETE FROM agent_embeddings WHERE source_type = ? AND source_id = ?`,
      args: [sourceType, sourceId]
    });
  }

  public async clearEmbeddings(): Promise<void> {
    await this.db.execute(`DELETE FROM agent_embeddings;`);
  }

  // --- IEmbeddingStorage 迁移核心 (重切模型维度 / 断点保护机制) ---

  public async hasPendingMigration(): Promise<boolean> {
     const checkTable = await this.db.execute({
       sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, 
       args: [this.BACKUP_TABLE]
     });
     if (checkTable.rows.length === 0) return false;
     
     const countRow = await this.db.execute(`SELECT count(*) as c FROM ${this.BACKUP_TABLE} WHERE is_migrated = 0`);
     return Number(countRow.rows[0]?.c ?? 0) > 0;
  }

  public async countHeterogeneousEmbeddings(currentModelId: string): Promise<number> {
    const checkTable = await this.db.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name='agent_embeddings'`);
    if (checkTable.rows.length === 0) return 0;
    
    const countRow = await this.db.execute({
      sql: `SELECT count(*) as c FROM agent_embeddings WHERE model_id != ?`,
      args: [currentModelId]
    });
    return Number(countRow.rows[0]?.c ?? 0);
  }

  public async createMigrationBackup(): Promise<number> {
    await this.db.execute(`DROP TABLE IF EXISTS ${this.BACKUP_TABLE};`);
    
    await this.db.execute(`
      CREATE TABLE ${this.BACKUP_TABLE} AS
      SELECT id, source_type, source_id, group_id, chunk_index, chunk_text, metadata_json, source_created_at, 0 as is_migrated
      FROM agent_embeddings;
    `);

    await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_backup_migrated ON ${this.BACKUP_TABLE}(is_migrated);`);

    const count = await this.db.execute(`SELECT count(*) as c FROM ${this.BACKUP_TABLE}`);
    return Number(count.rows[0]?.c ?? 0);
  }

  public async dropMigrationBackup(): Promise<void> {
    await this.db.execute(`DROP TABLE IF EXISTS ${this.BACKUP_TABLE};`);
  }

  public async clearAndReinitEmbeddings(dimension: number): Promise<void> {
      await this.db.execute(`DELETE FROM agent_embeddings;`);
      await this.initVectorTables(dimension, true);
  }

  public async getUnmigratedCount(): Promise<number> {
    try {
        const countRow = await this.db.execute(`SELECT count(*) as c FROM ${this.BACKUP_TABLE} WHERE is_migrated = 0`);
        return Number(countRow.rows[0]?.c ?? 0);
    } catch (e) {
        return 0; // 若表不存在
    }
  }

  public async getUnmigratedBackupChunks(): Promise<any[]> {
    try {
      const res = await this.db.execute(`
        SELECT id, source_type as sourceType, source_id as sourceId, group_id as groupId,
               chunk_index as chunkIndex, chunk_text as chunkText, metadata_json as metadataJson,
               source_created_at as sourceCreatedAt
        FROM ${this.BACKUP_TABLE}
        WHERE is_migrated = 0
        LIMIT 50
      `);
      return Array.from(res.rows);
    } catch {
      return [];
    }
  }

  public async markBackupChunkMigrated(embeddingId: string): Promise<void> {
    await this.db.execute({
      sql: `UPDATE ${this.BACKUP_TABLE} SET is_migrated = 1 WHERE id = ?`,
      args: [embeddingId]
    });
  }

  public async verifyMigrationComplete(modelId: string): Promise<[boolean, boolean]> {
      const pending = await this.hasPendingMigration();
      const mismatchedCount = await this.countHeterogeneousEmbeddings(modelId);
      return [!pending, mismatchedCount === 0];
  }


  // --- IHybridSearchStorage API (由上面的查询底层接口组成) ---

  public supportsNativeVectorSearch(): boolean {
    return true; // LibSQL原生支持
  }

  public async queryFTS(keyword: string, limit: number): Promise<ISearchResult[]> {
    const res = await this.db.execute({
      sql: `
      SELECT id as messageId, group_id as sessionId, chunk_text as chunkText, source_created_at as createdAt
      FROM agent_embeddings
      WHERE chunk_text LIKE ?
      LIMIT ?
      `,
      args: [`%${keyword}%`, limit]
    });
    
    return Array.from(res.rows).map((r, i) => ({
      messageId: r.messageId as string, sessionId: r.sessionId as string, chunkText: r.chunkText as string,
      score: limit - i, source: 'fts', createdAt: r.createdAt as number
    }));
  }

  public async queryNativeVector(vector: number[], limit: number, threshold?: number): Promise<ISearchResult[]> {
    const vectorStr = `[${vector.join(',')}]`;
    
    let sql = `
      SELECT id, group_id as sessionId, chunk_text as chunkText, source_created_at as createdAt,
             vector_distance_cos(embedding, vector(?)) as distance
      FROM agent_embeddings
      ORDER BY distance ASC
      LIMIT ?
    `;
    let args: any[] = [vectorStr, limit];

    // Note: To implement strict threshold, we can filter after query or in a subquery
    
    const res = await this.db.execute({ sql, args });

    let results = Array.from(res.rows).map(r => ({
      messageId: r.id as string, sessionId: r.sessionId as string, chunkText: r.chunkText as string,
      score: 1.0 - (typeof r.distance === 'number' ? r.distance : 0.0), source: 'vector', createdAt: r.createdAt as number
    }));

    if (threshold !== undefined) {
      results = results.filter(r => r.score >= threshold);
    }
    return results;
  }

  public async fetchAllEmbeddingsForDecoupledSearch(sessionGroupId?: string): Promise<{ messageId: string; sessionId: string; chunkText: string; embedding: number[]; createdAt?: number; }[]> {
    let sql = `SELECT id, group_id as sessionId, chunk_text as chunkText, vector_extract(embedding) as embeddingStr, source_created_at as createdAt FROM agent_embeddings`;
    let args: any[] = [];
    if (sessionGroupId) {
       sql += ` WHERE group_id = ?`;
       args.push(sessionGroupId);
    }
    const res = await this.db.execute({ sql, args });
    
    return Array.from(res.rows).map(r => {
      let embeddingArr: number[] = [];
      try {
        embeddingArr = JSON.parse(r.embeddingStr as string);
      } catch (e) {}
      
      return {
        messageId: r.id as string, sessionId: r.sessionId as string, chunkText: r.chunkText as string,
        embedding: embeddingArr, createdAt: r.createdAt as number
      };
    });
  }
}
