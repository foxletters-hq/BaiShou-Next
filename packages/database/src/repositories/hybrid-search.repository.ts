import { Client } from '@libsql/client';
import { IHybridSearchStorage, ISearchResult } from '@baishou/ai/src/rag/hybrid-search.types';
import { IEmbeddingStorage } from '@baishou/ai/src/rag/embedding.types';
import { logger } from '@baishou/shared';

/**
 * SQLite + libsql 混合搜索仓库
 *
 * 目标表：memory_embeddings（与 Drizzle ORM 管理的 memoryEmbeddingsTable 共用同一张物理表）
 *
 * 表结构对齐 packages/database/src/schema/vectors.ts：
 *   id              INTEGER PK AUTOINCREMENT
 *   embedding_id    TEXT UNIQUE NOT NULL
 *   source_type     TEXT NOT NULL
 *   source_id       TEXT NOT NULL
 *   group_id        TEXT NOT NULL
 *   chunk_index     INTEGER NOT NULL
 *   chunk_text      TEXT NOT NULL
 *   metadata_json   TEXT NOT NULL
 *   embedding       BLOB NOT NULL（Float32Array 二进制）
 *   dimension       INTEGER NOT NULL
 *   model_id        TEXT NOT NULL
 *   created_at      TIMESTAMP NOT NULL
 *   source_created_at TIMESTAMP
 *
 * 向量搜索策略：
 * - libsql 原生 vector_top_k ANN 检索（若 F32_BLOB 列兼容则可用）
 * - vec_distance_cosine 暴力余弦距离（通用可靠方案）
 * - 纯 JS 余弦距离降级（无扩展时的兜底）
 */
export class SqliteHybridSearchRepository implements IHybridSearchStorage, IEmbeddingStorage {
  /** 表名与 Drizzle schema 对齐 */
  private static readonly TABLE = 'memory_embeddings';
  private static readonly BACKUP_TABLE = 'memory_embeddings_migration_backup';
  private static readonly INDEX_NAME = 'idx_memory_embeddings_vec';

  /** 运行时探测结果缓存（null = 尚未探测） */
  private _nativeVectorSupported: boolean | null = null;
  /** vec_distance_cosine 是否可用 */
  private _vecDistanceCosineAvailable: boolean | null = null;
  /** vector_top_k 是否可用 */
  private _vectorTopKAvailable: boolean | null = null;

  constructor(private readonly db: Client) {}

  // ── IEmbeddingStorage 核心 ─────────────────────────────

  /**
   * 初始化向量索引（table 由 Drizzle 迁移管理，此处仅尝试建立 ANN 索引）
   */
  public async initVectorIndex(dimension: number): Promise<void> {
    await this.initVectorTables(dimension, false);
  }

  /**
   * 建立 ANN 索引（table 已由 Drizzle ORM 管理，不再 CREATE TABLE）
   */
  public async initVectorTables(dimension: number, _forceRebuild = false): Promise<void> {
    // 表结构由 Drizzle ORM 的 memoryEmbeddingsTable 管理，此处不重复建表

    // libsql 原生 ANN 向量索引（metric=cosine）
    if (dimension > 0) {
      try {
        await this.db.execute(
          `CREATE INDEX IF NOT EXISTS ${SqliteHybridSearchRepository.INDEX_NAME} ON ${SqliteHybridSearchRepository.TABLE} (libsql_vector_idx(embedding, 'metric=cosine'))`
        );
        logger.info(`[VectorSearch] ANN 索引已就绪（dim=${dimension}, metric=cosine）`);
      } catch (e: any) {
        logger.warn('[VectorSearch] ANN 索引创建失败（将使用降级搜索）:', e.message);
      }
    }
  }

  /**
   * 插入向量嵌入
   * 使用 Buffer(Float32Array) 格式对齐 DesktopEmbeddingStorage 的序列化方式
   */
  public async insertEmbedding(params: {
    id: string; sourceType: string; sourceId: string; groupId: string;
    chunkIndex: number; chunkText: string; metadataJson?: string;
    embedding: number[]; modelId: string; sourceCreatedAt?: number;
  }): Promise<void> {
    const vectorBuffer = Buffer.from(new Float32Array(params.embedding).buffer);
    await this.db.execute({
      sql: `
        INSERT INTO ${SqliteHybridSearchRepository.TABLE}
        (embedding_id, source_type, source_id, group_id, chunk_index, chunk_text,
         metadata_json, embedding, dimension, model_id, created_at, source_created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(embedding_id) DO UPDATE SET
          chunk_text = excluded.chunk_text,
          embedding = excluded.embedding,
          dimension = excluded.dimension,
          model_id = excluded.model_id,
          metadata_json = excluded.metadata_json
      `,
      args: [
        params.id, params.sourceType, params.sourceId, params.groupId,
        params.chunkIndex, params.chunkText, params.metadataJson || '{}',
        vectorBuffer, params.embedding.length, params.modelId,
        Date.now(), params.sourceCreatedAt || Date.now()
      ]
    });
  }

  public async deleteEmbeddingsBySource(sourceType: string, sourceId: string): Promise<void> {
    await this.db.execute({
      sql: `DELETE FROM ${SqliteHybridSearchRepository.TABLE} WHERE source_type = ? AND source_id = ?`,
      args: [sourceType, sourceId]
    });
  }

  public async clearEmbeddings(): Promise<void> {
    await this.db.execute(`DELETE FROM ${SqliteHybridSearchRepository.TABLE}`);
  }

  // ── IEmbeddingStorage 迁移核心 ──────────────────────────

  public async hasPendingMigration(): Promise<boolean> {
    const checkTable = await this.db.execute({
      sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      args: [SqliteHybridSearchRepository.BACKUP_TABLE]
    });
    if (checkTable.rows.length === 0) return false;

    const countRow = await this.db.execute(
      `SELECT count(*) as c FROM ${SqliteHybridSearchRepository.BACKUP_TABLE} WHERE is_migrated = 0`
    );
    return Number(countRow.rows[0]?.c ?? 0) > 0;
  }

  public async countHeterogeneousEmbeddings(currentModelId: string): Promise<number> {
    const checkTable = await this.db.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${SqliteHybridSearchRepository.TABLE}'`
    );
    if (checkTable.rows.length === 0) return 0;

    const countRow = await this.db.execute({
      sql: `SELECT count(*) as c FROM ${SqliteHybridSearchRepository.TABLE} WHERE model_id != ?`,
      args: [currentModelId]
    });
    return Number(countRow.rows[0]?.c ?? 0);
  }

  public async createMigrationBackup(): Promise<number> {
    await this.db.execute(`DROP TABLE IF EXISTS ${SqliteHybridSearchRepository.BACKUP_TABLE}`);
    await this.db.execute(`
      CREATE TABLE ${SqliteHybridSearchRepository.BACKUP_TABLE} AS
      SELECT embedding_id, source_type, source_id, group_id, chunk_index, chunk_text,
             metadata_json, source_created_at, 0 as is_migrated
      FROM ${SqliteHybridSearchRepository.TABLE}
    `);
    await this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_mig_backup_migrated ON ${SqliteHybridSearchRepository.BACKUP_TABLE}(is_migrated)`
    );
    const count = await this.db.execute(`SELECT count(*) as c FROM ${SqliteHybridSearchRepository.BACKUP_TABLE}`);
    return Number(count.rows[0]?.c ?? 0);
  }

  public async dropMigrationBackup(): Promise<void> {
    await this.db.execute(`DROP TABLE IF EXISTS ${SqliteHybridSearchRepository.BACKUP_TABLE}`);
  }

  public async clearAndReinitEmbeddings(dimension: number): Promise<void> {
    await this.clearEmbeddings();
    await this.initVectorTables(dimension, false);
  }

  public async getUnmigratedCount(): Promise<number> {
    try {
      const countRow = await this.db.execute(
        `SELECT count(*) as c FROM ${SqliteHybridSearchRepository.BACKUP_TABLE} WHERE is_migrated = 0`
      );
      return Number(countRow.rows[0]?.c ?? 0);
    } catch {
      return 0;
    }
  }

  public async getUnmigratedBackupChunks(): Promise<any[]> {
    try {
      const res = await this.db.execute(`
        SELECT embedding_id, source_type as sourceType, source_id as sourceId, group_id as groupId,
               chunk_index as chunkIndex, chunk_text as chunkText, metadata_json as metadataJson,
               source_created_at as sourceCreatedAt
        FROM ${SqliteHybridSearchRepository.BACKUP_TABLE}
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
      sql: `UPDATE ${SqliteHybridSearchRepository.BACKUP_TABLE} SET is_migrated = 1 WHERE embedding_id = ?`,
      args: [embeddingId]
    });
  }

  public async verifyMigrationComplete(modelId: string): Promise<[boolean, boolean]> {
    const pending = await this.hasPendingMigration();
    const mismatchedCount = await this.countHeterogeneousEmbeddings(modelId);
    return [!pending, mismatchedCount === 0];
  }

  // ── IHybridSearchStorage API ────────────────────────────

  /**
   * 运行时探测原生向量搜索支持情况
   * 结果缓存，首次调用后不再重复探测
   */
  public supportsNativeVectorSearch(): boolean {
    return this._nativeVectorSupported !== false;
  }

  public async queryFTS(keyword: string, limit: number): Promise<ISearchResult[]> {
    const res = await this.db.execute({
      sql: `
        SELECT embedding_id, group_id AS sessionId, chunk_text AS chunkText,
               source_created_at AS createdAt
        FROM ${SqliteHybridSearchRepository.TABLE}
        WHERE chunk_text LIKE ?
        LIMIT ?
      `,
      args: [`%${keyword}%`, limit]
    });

    return Array.from(res.rows).map((r, i) => ({
      messageId: r.embedding_id as string,
      sessionId: r.sessionId as string,
      chunkText: r.chunkText as string,
      score: limit - i,
      source: 'fts' as const,
      createdAt: r.createdAt as number
    }));
  }

  /**
   * 原生向量相似度搜索
   *
   * 主路径：vec_distance_cosine 暴力余弦距离（对齐 MemoryRepository 实现，兼容普通 BLOB 列）
   * 备选路径：vector_top_k ANN 检索（需要 libsql 原生 F32_BLOB 列类型）
   * 降级路径：全表读取 + JS 余弦距离计算
   */
  public async queryNativeVector(vector: number[], limit: number, threshold?: number): Promise<ISearchResult[]> {
    const vectorBuffer = Buffer.from(new Float32Array(vector).buffer);
    const vectorStr = `[${vector.join(',')}]`;

    // ── 路径 1: vec_distance_cosine（首次失败后缓存跳过） ──
    if (this._vecDistanceCosineAvailable !== false) {
      try {
        const results = await this._queryWithVecDistanceCosine(vectorBuffer, limit, vector, threshold);
        this._vecDistanceCosineAvailable = true;
        return results;
      } catch (e: any) {
        this._vecDistanceCosineAvailable = false;
        logger.warn('[VectorSearch] vec_distance_cosine 不可用，已缓存为降级路径:', (e as Error).message);
      }
    }

    // ── 路径 2: vector_top_k（首次失败后缓存跳过） ──
    if (this._vectorTopKAvailable !== false) {
      try {
        const results = await this._queryWithVectorTopK(vectorStr, limit, threshold);
        this._vectorTopKAvailable = true;
        this._nativeVectorSupported = true;
        return results;
      } catch (e: any) {
        this._vectorTopKAvailable = false;
        this._nativeVectorSupported = false;
        logger.warn('[VectorSearch] vector_top_k 不可用，已缓存为降级路径:', (e as Error).message);
      }
    }

    // ── 路径 3: JS 余弦距离降级 ──
    return this._queryWithJSCosine(vectorStr, vector, limit, threshold);
  }

  /**
   * 使用 vec_distance_cosine 进行向量搜索（对齐 MemoryRepository.searchByVector）
   */
  private async _queryWithVecDistanceCosine(
    vectorBuffer: Buffer,
    limit: number,
    _queryVector: number[],
    threshold?: number
  ): Promise<ISearchResult[]> {
    const res = await this.db.execute({
      sql: `
        SELECT embedding_id, source_id, group_id AS sessionId, chunk_text AS chunkText,
               source_created_at AS createdAt,
               vec_distance_cosine(embedding, ?) AS distance
        FROM ${SqliteHybridSearchRepository.TABLE}
        ORDER BY vec_distance_cosine(embedding, ?) ASC
        LIMIT ?
      `,
      args: [vectorBuffer, vectorBuffer, limit]
    });

    let results = Array.from(res.rows).map(r => ({
      messageId: r.embedding_id as string,
      sessionId: r.sessionId as string,
      chunkText: r.chunkText as string,
      score: 1.0 - (typeof r.distance === 'number' ? r.distance : 0.0),
      source: 'vector' as const,
      createdAt: r.createdAt as number
    }));

    if (threshold !== undefined) {
      results = results.filter(r => r.score >= threshold);
    }
    return results;
  }

  /**
   * libsql 原生 ANN 向量搜索（使用 vector_top_k table-valued function）
   */
  private async _queryWithVectorTopK(vectorStr: string, limit: number, threshold?: number): Promise<ISearchResult[]> {
    const res = await this.db.execute({
      sql: `
        SELECT ae.embedding_id, ae.group_id AS sessionId, ae.chunk_text AS chunkText,
               ae.source_created_at AS createdAt, vt.distance
        FROM vector_top_k('${SqliteHybridSearchRepository.INDEX_NAME}', vector(?), ?) AS vt
        JOIN ${SqliteHybridSearchRepository.TABLE} ae ON ae.rowid = vt.id
      `,
      args: [vectorStr, limit]
    });

    let results = Array.from(res.rows).map(r => ({
      messageId: r.embedding_id as string,
      sessionId: r.sessionId as string,
      chunkText: r.chunkText as string,
      score: 1.0 - (typeof r.distance === 'number' ? r.distance : 0.0),
      source: 'vector' as const,
      createdAt: r.createdAt as number
    }));

    if (threshold !== undefined) {
      results = results.filter(r => r.score >= threshold);
    }
    return results;
  }

  /**
   * 纯 JS 余弦距离降级搜索
   * 读取全表 embedding blob → Float32Array → 余弦距离 → Top-K
   */
  private async _queryWithJSCosine(
    _vectorStr: string,
    queryVector: number[],
    limit: number,
    threshold?: number
  ): Promise<ISearchResult[]> {
    try {
      const res = await this.db.execute(
        `SELECT embedding_id, group_id AS sessionId, chunk_text AS chunkText,
                source_created_at AS createdAt,
                hex(embedding) AS embeddingHex
         FROM ${SqliteHybridSearchRepository.TABLE}`
      );

      const dimension = queryVector.length;
      const scored: Array<ISearchResult & { _dist: number }> = [];

      for (const r of res.rows) {
        try {
          const hexStr = r.embeddingHex as string;
          if (!hexStr) continue;

          // 将 hex 字符串解析为 Float32Array
          const buffer = Buffer.from(hexStr, 'hex');
          if (buffer.length < dimension * 4) continue;

          const embArr = new Float32Array(buffer.buffer, buffer.byteOffset, dimension);

          let dot = 0, normA = 0, normB = 0;
          for (let i = 0; i < dimension; i++) {
            dot += (queryVector[i] ?? 0) * (embArr[i] ?? 0);
            normA += (queryVector[i] ?? 0) * (queryVector[i] ?? 0);
            normB += (embArr[i] ?? 0) * (embArr[i] ?? 0);
          }
          const distance = (normA > 0 && normB > 0)
            ? 1.0 - dot / (Math.sqrt(normA) * Math.sqrt(normB))
            : 1.0;

          scored.push({
            messageId: r.embedding_id as string,
            sessionId: r.sessionId as string,
            chunkText: r.chunkText as string,
            score: 1.0 - distance,
            source: 'vector' as const,
            createdAt: r.createdAt as number,
            _dist: distance
          });
        } catch { continue; }
      }

      scored.sort((a, b) => a._dist - b._dist);
      let results = scored.slice(0, limit).map(({ _dist: _, ...r }) => r);

      if (threshold !== undefined) {
        results = results.filter(r => r.score >= threshold);
      }
      return results;
    } catch (e: any) {
      logger.error('[VectorSearch] JS 余弦降级也失败了:', e.message);
      return [];
    }
  }

  public async fetchAllEmbeddingsForDecoupledSearch(sessionGroupId?: string): Promise<{
    messageId: string; sessionId: string; chunkText: string; embedding: number[]; createdAt?: number;
  }[]> {
    let sql = `SELECT embedding_id, group_id AS sessionId, chunk_text AS chunkText,
                      hex(embedding) AS embeddingHex,
                      source_created_at AS createdAt
               FROM ${SqliteHybridSearchRepository.TABLE}`;
    const args: any[] = [];
    if (sessionGroupId) {
      sql += ` WHERE group_id = ?`;
      args.push(sessionGroupId);
    }

    const res = await this.db.execute({ sql, args });
    return Array.from(res.rows).map(r => {
      let embeddingArr: number[] = [];
      try {
        const hexStr = r.embeddingHex as string;
        if (hexStr) {
          const buffer = Buffer.from(hexStr, 'hex');
          embeddingArr = Array.from(new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4));
        }
      } catch {}
      return {
        messageId: r.embedding_id as string,
        sessionId: r.sessionId as string,
        chunkText: r.chunkText as string,
        embedding: embeddingArr,
        createdAt: r.createdAt as number
      };
    });
  }
}
