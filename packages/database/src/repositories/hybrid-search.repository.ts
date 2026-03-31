import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { IHybridSearchStorage, ISearchResult, IEmbeddingStorage } from '@baishou/ai';

export class SqliteHybridSearchRepository implements IHybridSearchStorage, IEmbeddingStorage {
  private isVecLoaded = false;
  private readonly BACKUP_TABLE = 'agent_embeddings_backup';

  constructor(private readonly db: Database.Database) {
    this.tryLoadVecExtension();
  }

  private tryLoadVecExtension() {
    try {
      sqliteVec.load(this.db);
      this.isVecLoaded = true;
    } catch (e) {
      console.warn('SqliteHybridSearchRepository: Failed to load sqlite-vec extension.', e);
      this.isVecLoaded = false;
    }
  }

  // --- IEmbeddingStorage 核心 ---

  public async initVectorIndex(dimension: number): Promise<void> {
    this.initVectorTables(dimension, false);
  }

  public initVectorTables(dimension: number, forceRebuild = false) {
    if (forceRebuild && this.isVecLoaded) {
      this.db.exec(`DROP TABLE IF EXISTS vec_agent_embeddings;`);
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_embeddings (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        metadata_json TEXT DEFAULT '{}',
        embedding BLOB NOT NULL,
        model_id TEXT NOT NULL,
        source_created_at INTEGER
      );
    `);

    if (this.isVecLoaded && dimension > 0) {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS vec_agent_embeddings USING vec0(
          id TEXT PRIMARY KEY, 
          embedding float[${dimension}]
        );
      `);

      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS ai_embeddings_after_insert
        AFTER INSERT ON agent_embeddings
        BEGIN
          INSERT INTO vec_agent_embeddings(id, embedding)
          VALUES (new.id, new.embedding);
        END;
      `);

      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS ai_embeddings_after_delete
        AFTER DELETE ON agent_embeddings
        BEGIN
          DELETE FROM vec_agent_embeddings WHERE id = old.id;
        END;
      `);

      this.db.exec(`
        CREATE TRIGGER IF NOT EXISTS ai_embeddings_after_update
        AFTER UPDATE ON agent_embeddings
        BEGIN
          UPDATE vec_agent_embeddings 
          SET embedding = new.embedding 
          WHERE id = old.id;
        END;
      `);
    }
  }

  public async insertEmbedding(params: {
        id: string; sourceType: string; sourceId: string; groupId: string; 
        chunkIndex: number; chunkText: string; metadataJson?: string; 
        embedding: number[]; modelId: string; sourceCreatedAt?: number;
    }): Promise<void> {
        const stmt = this.db.prepare(`
          INSERT OR REPLACE INTO agent_embeddings 
          (id, source_type, source_id, group_id, chunk_index, chunk_text, metadata_json, embedding, model_id, source_created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const buffer = Buffer.from(new Float32Array(params.embedding).buffer);
        stmt.run(params.id, params.sourceType, params.sourceId, params.groupId, params.chunkIndex, 
            params.chunkText, params.metadataJson || '{}', buffer, params.modelId, params.sourceCreatedAt || Date.now());
  }

  public async deleteEmbeddingsBySource(sourceType: string, sourceId: string): Promise<void> {
    this.db.prepare(`DELETE FROM agent_embeddings WHERE source_type = ? AND source_id = ?`).run(sourceType, sourceId);
  }

  public async clearEmbeddings(): Promise<void> {
    this.db.exec(`DELETE FROM agent_embeddings;`);
  }

  // --- IEmbeddingStorage 迁移核心 (重切模型维度 / 断点保护机制) ---

  public async hasPendingMigration(): Promise<boolean> {
     const checkTable = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(this.BACKUP_TABLE);
     if (!checkTable) return false;
     
     const countRow = this.db.prepare(`SELECT count(*) as c FROM ${this.BACKUP_TABLE} WHERE is_migrated = 0`).get() as any;
     return countRow.c > 0;
  }

  public async countHeterogeneousEmbeddings(currentModelId: string): Promise<number> {
    const checkTable = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='agent_embeddings'`).get();
    if (!checkTable) return 0;
    const countRow = this.db.prepare(`SELECT count(*) as c FROM agent_embeddings WHERE model_id != ?`).get(currentModelId) as any;
    return countRow.c;
  }

  public async createMigrationBackup(): Promise<number> {
    // 创建一个包含 is_migrated 标志位的等价虚影表，仅作为临时缓冲池，剥离沉重的 Float 向量阵列减小负担！
    this.db.exec(`DROP TABLE IF EXISTS ${this.BACKUP_TABLE};`);
    
    // SQLite 的高明之处：快速拷贝数据但不要那个巨大的 BLOB embedding 载体，因为这是要重新发给新大模型算的，拿来也废
    this.db.exec(`
      CREATE TABLE ${this.BACKUP_TABLE} AS
      SELECT id, source_type, source_id, group_id, chunk_index, chunk_text, metadata_json, source_created_at, 0 as is_migrated
      FROM agent_embeddings;
    `);

    // 构建加速更新索引
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_backup_migrated ON ${this.BACKUP_TABLE}(is_migrated);`);

    const count = this.db.prepare(`SELECT count(*) as c FROM ${this.BACKUP_TABLE}`).get() as any;
    return count.c;
  }

  public async dropMigrationBackup(): Promise<void> {
    this.db.exec(`DROP TABLE IF EXISTS ${this.BACKUP_TABLE};`);
  }

  public async clearAndReinitEmbeddings(dimension: number): Promise<void> {
      // 抹除原本挂载在大网上的全集数据 (触发器会同端消灭老的不兼容维度在 C++ vec 层内的挂件)
      this.db.exec(`DELETE FROM agent_embeddings;`);
      this.initVectorTables(dimension, true);
  }

  public async getUnmigratedCount(): Promise<number> {
    try {
        const countRow = this.db.prepare(`SELECT count(*) as c FROM ${this.BACKUP_TABLE} WHERE is_migrated = 0`).get() as any;
        return countRow.c;
    } catch (e) {
        return 0; // 若表不存在
    }
  }

  public async getUnmigratedBackupChunks(): Promise<any[]> {
    try {
      // 每次取 50 块作为打断粒度的恢复单元，防止超发引起重跑的冗余
      const rows = this.db.prepare(`
        SELECT id, source_type as sourceType, source_id as sourceId, group_id as groupId,
               chunk_index as chunkIndex, chunk_text as chunkText, metadata_json as metadataJson,
               source_created_at as sourceCreatedAt
        FROM ${this.BACKUP_TABLE}
        WHERE is_migrated = 0
        LIMIT 50
      `).all() as any[];
      return rows;
    } catch {
      return [];
    }
  }

  public async markBackupChunkMigrated(embeddingId: string): Promise<void> {
    this.db.prepare(`UPDATE ${this.BACKUP_TABLE} SET is_migrated = 1 WHERE id = ?`).run(embeddingId);
  }

  public async verifyMigrationComplete(modelId: string): Promise<[boolean, boolean]> {
      const pending = await this.hasPendingMigration();
      const mismatchedCount = await this.countHeterogeneousEmbeddings(modelId);
      return [!pending, mismatchedCount === 0];
  }


  // --- IHybridSearchStorage API (由上面的查询底层接口组成) ---

  public supportsNativeVectorSearch(): boolean {
    return this.isVecLoaded;
  }

  public async queryFTS(keyword: string, limit: number): Promise<ISearchResult[]> {
    const stmt = this.db.prepare(`
      SELECT id as messageId, group_id as sessionId, chunk_text as chunkText, source_created_at as createdAt
      FROM agent_embeddings
      WHERE chunk_text LIKE ?
      LIMIT ?
    `);
    const rows = stmt.all(`%${keyword}%`, limit) as any[];
    return rows.map((r, i) => ({
      messageId: r.messageId, sessionId: r.sessionId, chunkText: r.chunkText,
      score: limit - i, source: 'fts', createdAt: r.createdAt
    }));
  }

  public async queryNativeVector(vector: number[], limit: number, threshold?: number): Promise<ISearchResult[]> {
    if (!this.isVecLoaded) return [];
    const vecInput = new Float32Array(vector);
    const stmt = this.db.prepare(`
      SELECT a.id, a.group_id as sessionId, a.chunk_text as chunkText, a.source_created_at as createdAt,
             v.distance as rawDist
      FROM vec_agent_embeddings v
      INNER JOIN agent_embeddings a ON a.id = v.id
      WHERE v.embedding MATCH ? AND k = ?${threshold !== undefined ? ' AND v.distance <= ?' : ''}
    `);
    
    let rows: any[];
    if (threshold !== undefined) {
      rows = stmt.all(vecInput, limit, threshold);
    } else {
      rows = stmt.all(vecInput, limit);
    }

    return rows.map(r => ({
      messageId: r.id, sessionId: r.sessionId, chunkText: r.chunkText,
      score: 1.0 - r.rawDist, source: 'vector', createdAt: r.createdAt
    }));
  }

  public async fetchAllEmbeddingsForDecoupledSearch(sessionGroupId?: string): Promise<{ messageId: string; sessionId: string; chunkText: string; embedding: number[]; createdAt?: number; }[]> {
    let stmt = this.db.prepare(`SELECT id, group_id as sessionId, chunk_text as chunkText, embedding, source_created_at as createdAt FROM agent_embeddings`);
    if (sessionGroupId) {
       stmt = this.db.prepare(`SELECT id, group_id as sessionId, chunk_text as chunkText, embedding, source_created_at as createdAt FROM agent_embeddings WHERE group_id = ?`);
    }
    const rows = (sessionGroupId ? stmt.all(sessionGroupId) : stmt.all()) as any[];
    return rows.map(r => {
      const floatArr = new Float32Array(r.embedding.buffer, r.embedding.byteOffset, r.embedding.byteLength / 4);
      return {
        messageId: r.id, sessionId: r.sessionId, chunkText: r.chunkText,
        embedding: Array.from(floatArr), createdAt: r.createdAt
      };
    });
  }
}
