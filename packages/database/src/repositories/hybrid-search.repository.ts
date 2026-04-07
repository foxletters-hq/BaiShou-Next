import { Client } from '@libsql/client';
import { IHybridSearchStorage, ISearchResult } from '@baishou/ai/src/rag/hybrid-search.types';
import { IEmbeddingStorage } from '@baishou/ai/src/rag/embedding.types';

/**
 * SQLite + libsql 混合搜索仓库
 *
 * 向量搜索策略（对标原版 sqlite-vector 设计）：
 *
 * **主路径（libsql 原生）**：
 *   - 列类型：`F32_BLOB(dimension)` — libsql 原生浮点向量 blob
 *   - 索引：`libsql_vector_idx(embedding, 'metric=cosine')` — ANN 索引
 *   - 查询：`vector_top_k('idx_name', vector(?), limit)` TABLE-VALUED FUNCTION
 *   - 性能：O(log N) ANN 查询，硬件加速
 *
 * **降级路径（纯 JS 余弦距离）**：
 *   - 当 `vector_top_k` 或 `vector_distance_cos` 抛出异常时自动触发
 *   - 从 `agent_embeddings` 全表读取 embedding blob → JS Float32Array → 余弦距离排序
 *   - `supportsNativeVectorSearch()` 运行时首次探测，结果缓存
 */
export class SqliteHybridSearchRepository implements IHybridSearchStorage, IEmbeddingStorage {
  private readonly BACKUP_TABLE = 'agent_embeddings_backup';
  private readonly INDEX_NAME = 'idx_agent_embeddings_vec';

  /** 运行时探测结果缓存（null = 尚未探测） */
  private _nativeVectorSupported: boolean | null = null;

  constructor(private readonly db: Client) {}

  // ── IEmbeddingStorage 核心 ─────────────────────────────

  public async initVectorIndex(dimension: number): Promise<void> {
    await this.initVectorTables(dimension, false);
  }

  /**
   * 建立或重建 agent_embeddings 表（含 F32_BLOB + ANN 索引）
   *
   * F32_BLOB(dimension) 是 libsql 的原生向量存储类型，
   * 等价于原版 Flutter 的 `sqlite_vector` 扩展对浮点 blob 的存储方式。
   */
  public async initVectorTables(dimension: number, forceRebuild = false): Promise<void> {
    if (forceRebuild) {
      await this.db.execute(`DROP TABLE IF EXISTS agent_embeddings`);
      this._nativeVectorSupported = null; // 重建后重新探测
    }

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS agent_embeddings (
        id              TEXT    PRIMARY KEY,
        source_type     TEXT    NOT NULL,
        source_id       TEXT    NOT NULL,
        group_id        TEXT    NOT NULL,
        chunk_index     INTEGER NOT NULL,
        chunk_text      TEXT    NOT NULL,
        metadata_json   TEXT    DEFAULT '{}',
        embedding       F32_BLOB(${dimension}) NOT NULL,
        model_id        TEXT    NOT NULL,
        source_created_at INTEGER
      )
    `);

    // libsql 原生 ANN 向量索引（metric=cosine）
    if (dimension > 0) {
      try {
        await this.db.execute(
          `CREATE INDEX IF NOT EXISTS ${this.INDEX_NAME} ON agent_embeddings (libsql_vector_idx(embedding, 'metric=cosine'))`
        );
        console.log(`[VectorSearch] ANN 索引已就绪（dim=${dimension}, metric=cosine）`);
      } catch (e: any) {
        console.warn('[VectorSearch] ANN 索引创建失败（将使用全表扫描降级）:', e.message);
      }
    }
  }

  /**
   * 插入向量嵌入
   * 使用 libsql 原生 `vector(?)` 函数将 JSON 数组字符串转换为 F32_BLOB 存储
   */
  public async insertEmbedding(params: {
    id: string; sourceType: string; sourceId: string; groupId: string;
    chunkIndex: number; chunkText: string; metadataJson?: string;
    embedding: number[]; modelId: string; sourceCreatedAt?: number;
  }): Promise<void> {
    const vectorStr = `[${params.embedding.join(',')}]`;
    await this.db.execute({
      sql: `
        INSERT OR REPLACE INTO agent_embeddings
        (id, source_type, source_id, group_id, chunk_index, chunk_text,
         metadata_json, embedding, model_id, source_created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, vector(?), ?, ?)
      `,
      args: [
        params.id, params.sourceType, params.sourceId, params.groupId,
        params.chunkIndex, params.chunkText, params.metadataJson || '{}',
        vectorStr, params.modelId, params.sourceCreatedAt || Date.now()
      ]
    });
  }

  public async deleteEmbeddingsBySource(sourceType: string, sourceId: string): Promise<void> {
    await this.db.execute({
      sql: `DELETE FROM agent_embeddings WHERE source_type = ? AND source_id = ?`,
      args: [sourceType, sourceId]
    });
  }

  public async clearEmbeddings(): Promise<void> {
    await this.db.execute(`DELETE FROM agent_embeddings`);
  }

  // ── IEmbeddingStorage 迁移核心 ──────────────────────────

  public async hasPendingMigration(): Promise<boolean> {
    const checkTable = await this.db.execute({
      sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
      args: [this.BACKUP_TABLE]
    });
    if (checkTable.rows.length === 0) return false;

    const countRow = await this.db.execute(
      `SELECT count(*) as c FROM ${this.BACKUP_TABLE} WHERE is_migrated = 0`
    );
    return Number(countRow.rows[0]?.c ?? 0) > 0;
  }

  public async countHeterogeneousEmbeddings(currentModelId: string): Promise<number> {
    const checkTable = await this.db.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='agent_embeddings'`
    );
    if (checkTable.rows.length === 0) return 0;

    const countRow = await this.db.execute({
      sql: `SELECT count(*) as c FROM agent_embeddings WHERE model_id != ?`,
      args: [currentModelId]
    });
    return Number(countRow.rows[0]?.c ?? 0);
  }

  public async createMigrationBackup(): Promise<number> {
    await this.db.execute(`DROP TABLE IF EXISTS ${this.BACKUP_TABLE}`);
    await this.db.execute(`
      CREATE TABLE ${this.BACKUP_TABLE} AS
      SELECT id, source_type, source_id, group_id, chunk_index, chunk_text,
             metadata_json, source_created_at, 0 as is_migrated
      FROM agent_embeddings
    `);
    await this.db.execute(
      `CREATE INDEX IF NOT EXISTS idx_backup_migrated ON ${this.BACKUP_TABLE}(is_migrated)`
    );
    const count = await this.db.execute(`SELECT count(*) as c FROM ${this.BACKUP_TABLE}`);
    return Number(count.rows[0]?.c ?? 0);
  }

  public async dropMigrationBackup(): Promise<void> {
    await this.db.execute(`DROP TABLE IF EXISTS ${this.BACKUP_TABLE}`);
  }

  public async clearAndReinitEmbeddings(dimension: number): Promise<void> {
    await this.initVectorTables(dimension, true);
  }

  public async getUnmigratedCount(): Promise<number> {
    try {
      const countRow = await this.db.execute(
        `SELECT count(*) as c FROM ${this.BACKUP_TABLE} WHERE is_migrated = 0`
      );
      return Number(countRow.rows[0]?.c ?? 0);
    } catch {
      return 0;
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

  // ── IHybridSearchStorage API ────────────────────────────

  /**
   * 运行时探测 libsql 原生向量搜索支持情况
   * 结果缓存，首次调用后不再重复探测
   */
  public supportsNativeVectorSearch(): boolean {
    // 同步返回缓存结果（探测在 queryNativeVector 中异步完成）
    return this._nativeVectorSupported !== false;
  }

  public async queryFTS(keyword: string, limit: number): Promise<ISearchResult[]> {
    const res = await this.db.execute({
      sql: `
        SELECT id as messageId, group_id as sessionId, chunk_text as chunkText,
               source_created_at as createdAt
        FROM agent_embeddings
        WHERE chunk_text LIKE ?
        LIMIT ?
      `,
      args: [`%${keyword}%`, limit]
    });

    return Array.from(res.rows).map((r, i) => ({
      messageId: r.messageId as string,
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
   * **主路径**：使用 `vector_top_k(index_name, vector(query), k)` ANN 检索
   *   - 利用 libsql 建立的 `libsql_vector_idx` ANN 索引，O(log N) 检索
   *   - 等价于原版 `vector_full_scan` (sqlite-vec) 的作用
   *
   * **降级路径**：全表读取 + JS 余弦距离计算（与原版 Flutter Dart fallback 完全一致）
   *   - 从 `agent_embeddings` 全表读取 `vector_extract(embedding)` JSON 数组
   *   - 在 JS 中计算余弦距离并 Top-K 排序
   */
  public async queryNativeVector(vector: number[], limit: number, threshold?: number): Promise<ISearchResult[]> {
    const vectorStr = `[${vector.join(',')}]`;

    // ── 主路径：libsql 原生 vector_top_k ──
    if (this._nativeVectorSupported !== false) {
      try {
        const results = await this._queryWithVectorTopK(vectorStr, limit, threshold);
        this._nativeVectorSupported = true;
        return results;
      } catch (e: any) {
        console.warn('[VectorSearch] vector_top_k 不可用，切换至 JS 余弦降级:', e.message);
        this._nativeVectorSupported = false;
      }
    }

    // ── 降级路径：JS 余弦距离计算 ──
    return this._queryWithJSCosine(vectorStr, vector, limit, threshold);
  }

  /**
   * libsql 原生 ANN 向量搜索（使用 vector_top_k table-valued function）
   *
   * SQL：
   * ```sql
   * SELECT ae.id, ae.group_id, ae.chunk_text, ae.source_created_at, vt.distance
   * FROM vector_top_k('idx_agent_embeddings_vec', vector(?), ?) AS vt
   * JOIN agent_embeddings ae ON ae.rowid = vt.id
   * ```
   */
  private async _queryWithVectorTopK(vectorStr: string, limit: number, threshold?: number): Promise<ISearchResult[]> {
    const res = await this.db.execute({
      sql: `
        SELECT ae.id, ae.group_id AS sessionId, ae.chunk_text AS chunkText,
               ae.source_created_at AS createdAt, vt.distance
        FROM vector_top_k('${this.INDEX_NAME}', vector(?), ?) AS vt
        JOIN agent_embeddings ae ON ae.rowid = vt.id
      `,
      args: [vectorStr, limit]
    });

    let results = Array.from(res.rows).map(r => ({
      messageId: r.id as string,
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
   * 纯 JS 余弦距离降级搜索（对标原版 Flutter Dart fallback）
   * 读取全表 embedding blob → Float32Array → 余弦距离 → Top-K
   */
  private async _queryWithJSCosine(
    _vectorStr: string,
    queryVector: number[],
    limit: number,
    threshold?: number
  ): Promise<ISearchResult[]> {
    try {
      // 使用 vector_extract() 将 F32_BLOB 转为 JSON 数组字符串（libsql 内置）
      const res = await this.db.execute(
        `SELECT id, group_id AS sessionId, chunk_text AS chunkText,
                source_created_at AS createdAt,
                vector_extract(embedding) AS embeddingJson
         FROM agent_embeddings`
      );

      const dimension = queryVector.length;
      const scored: Array<ISearchResult & { _dist: number }> = [];

      for (const r of res.rows) {
        try {
          const embArr: number[] = JSON.parse((r.embeddingJson as string) ?? '[]');
          if (!embArr || embArr.length !== dimension) continue;

          // 余弦距离 = 1 - 余弦相似度
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
            messageId: r.id as string,
            sessionId: r.sessionId as string,
            chunkText: r.chunkText as string,
            score: 1.0 - distance,
            source: 'vector' as const,
            createdAt: r.createdAt as number,
            _dist: distance
          });
        } catch { continue; }
      }

      // 按距离升序（相似度降序）排序并取 Top-K
      scored.sort((a, b) => a._dist - b._dist);
      let results = scored.slice(0, limit).map(({ _dist: _, ...r }) => r);

      if (threshold !== undefined) {
        results = results.filter(r => r.score >= threshold);
      }
      return results;
    } catch (e: any) {
      console.error('[VectorSearch] JS 余弦降级也失败了:', e.message);
      return [];
    }
  }

  public async fetchAllEmbeddingsForDecoupledSearch(sessionGroupId?: string): Promise<{
    messageId: string; sessionId: string; chunkText: string; embedding: number[]; createdAt?: number;
  }[]> {
    let sql = `SELECT id, group_id AS sessionId, chunk_text AS chunkText,
                      vector_extract(embedding) AS embeddingJson,
                      source_created_at AS createdAt
               FROM agent_embeddings`;
    const args: any[] = [];
    if (sessionGroupId) {
      sql += ` WHERE group_id = ?`;
      args.push(sessionGroupId);
    }

    const res = await this.db.execute({ sql, args });
    return Array.from(res.rows).map(r => {
      let embeddingArr: number[] = [];
      try { embeddingArr = JSON.parse(r.embeddingJson as string); } catch {}
      return {
        messageId: r.id as string,
        sessionId: r.sessionId as string,
        chunkText: r.chunkText as string,
        embedding: embeddingArr,
        createdAt: r.createdAt as number
      };
    });
  }
}
