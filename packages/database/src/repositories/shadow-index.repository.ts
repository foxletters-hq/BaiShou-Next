import { eq, sql, like } from 'drizzle-orm';
import { shadowJournalIndexTable } from '../schema/shadow-index';
import { AppDatabase } from '../types';

/**
 * 影子索引记录（对齐原版 journals_index 表的查询结果）
 */
export interface ShadowJournalRecord {
  id: number;
  filePath: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  contentHash: string;
  weather: string | null;
  mood: string | null;
  location: string | null;
  locationDetail: string | null;
  isFavorite: boolean;
  hasMedia: boolean;
}

/**
 * Upsert 参数
 */
export interface UpsertShadowIndexPayload {
  id?: number;
  filePath: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  contentHash: string;
  weather?: string | null;
  mood?: string | null;
  location?: string | null;
  locationDetail?: string | null;
  isFavorite: boolean;
  hasMedia: boolean;
  /** raw markdown content 用于 FTS 索引 */
  rawContent: string;
  /** 逗号分隔的标签字符串 */
  tags: string;
}

/**
 * 影子全文搜索结果
 */
export interface ShadowFTSResult {
  rowid: number;
  contentSnippet: string;
  tags: string;
  rankScore: number;
}

/**
 * Shadow Index Repository
 * 
 * 像素级还原原版 `ShadowIndexDatabase` 的全部 CRUD 能力。
 * 
 * 核心设计理念：
 * - 影子索引是可被安全重建的——它只是物理文件的元数据镜像
 * - FTS5 表（journals_fts）跟随影子索引同步更新，确保全文搜索始终一致
 * - 所有方法通过注入的 AppDatabase 操作，不持有全局单例
 * - FTS 操作使用 libsql 裸 SQL（Drizzle 不直接支持 FTS5 虚拟表）
 *
 * 注意：此 Repository 操作的是 shadow_index.db 中的 `journals_index` 和 `journals_fts` 表，
 *       由 ShadowIndexConnectionManager connect() 后传入的 AppDatabase 实例来驱动。
 */
export class ShadowIndexRepository {
  constructor(private readonly database: AppDatabase) {}

  /**
   * 插入或更新单条日记的影子索引记录
   * 同时维护主表（journals_index）和 FTS 表（journals_fts）
   * 对标原版 `upsertJournalIndex()`
   */
  async upsert(payload: UpsertShadowIndexPayload): Promise<number> {
    const { rawContent, tags, ...indexData } = payload;

    // 1. Upsert 主索引表（journals_index）
    const result = await this.database
      .insert(shadowJournalIndexTable)
      .values({ ...indexData, rawContent, tags })
      .onConflictDoUpdate({
        target: [shadowJournalIndexTable.filePath],
        set: {
          date: indexData.date,
          createdAt: indexData.createdAt,
          updatedAt: indexData.updatedAt,
          contentHash: indexData.contentHash,
          weather: indexData.weather ?? null,
          mood: indexData.mood ?? null,
          location: indexData.location ?? null,
          locationDetail: indexData.locationDetail ?? null,
          isFavorite: indexData.isFavorite,
          hasMedia: indexData.hasMedia,
          rawContent,
          tags,
        },
      })
      .returning({ id: shadowJournalIndexTable.id });

    const rowId = result[0]?.id;
    if (rowId == null) {
      throw new Error('[ShadowIndex] upsert 返回了空 ID');
    }

    // 2. FTS 同步（journals_fts）：先删后插，保证幂等性
    try {
      await this.database.run(
        sql`DELETE FROM journals_fts WHERE rowid = ${rowId}`
      );
      await this.database.run(
        sql`INSERT INTO journals_fts(rowid, content, tags) VALUES(${rowId}, ${rawContent}, ${tags})`
      );
    } catch (e: any) {
      console.warn('[ShadowIndex] FTS 同步失败 (非阻塞):', e.message);
    }

    return rowId;
  }

  /**
   * 批量 Upsert 多个影子索引（开启单一大事务）
   * 对高并发下 SQLite 写锁非常友好
   */
  async batchUpsert(payloads: UpsertShadowIndexPayload[]): Promise<number[]> {
    if (payloads.length === 0) return [];

    const rowIds: number[] = [];

    await this.database.transaction(async (tx) => {
      for (const payload of payloads) {
        const { rawContent, tags, ...indexData } = payload;
        
        // 1. 主表写入
        const result = await tx
          .insert(shadowJournalIndexTable)
          .values({ ...indexData, rawContent, tags })
          .onConflictDoUpdate({
            target: [shadowJournalIndexTable.filePath],
            set: {
              date: indexData.date,
              createdAt: indexData.createdAt,
              updatedAt: indexData.updatedAt,
              contentHash: indexData.contentHash,
              weather: indexData.weather ?? null,
              mood: indexData.mood ?? null,
              location: indexData.location ?? null,
              locationDetail: indexData.locationDetail ?? null,
              isFavorite: indexData.isFavorite,
              hasMedia: indexData.hasMedia,
              rawContent,
              tags,
            },
          })
          .returning({ id: shadowJournalIndexTable.id });

        const rowId = result[0]?.id;
        if (rowId != null) {
          rowIds.push(rowId);
          
          // 2. FTS 同步
          try {
            await tx.run(sql`DELETE FROM journals_fts WHERE rowid = ${rowId}`);
            await tx.run(sql`INSERT INTO journals_fts(rowid, content, tags) VALUES(${rowId}, ${rawContent}, ${tags})`);
          } catch (e: any) {
            console.warn(`[ShadowIndex] 批量 FTS 同步失败 (非阻塞) [ID=${rowId}]:`, e.message);
          }
        }
      }
    });

    return rowIds;
  }

  /**
   * 删除指定 ID 的影子索引记录（同步清理 FTS 表）
   * 对标原版 `deleteJournalIndex()`
   */
  async deleteById(id: number): Promise<void> {
    await this.database
      .delete(shadowJournalIndexTable)
      .where(eq(shadowJournalIndexTable.id, id));

    try {
      await this.database.run(
        sql`DELETE FROM journals_fts WHERE rowid = ${id}`
      );
    } catch (e: any) {
      console.warn('[ShadowIndex] FTS 删除失败 (非阻塞):', e.message);
    }
  }

  /**
   * 按日期前缀查询索引记录 (yyyy-MM-dd%)
   * 用于 syncJournal 检测孤立索引
   */
  async findByDatePrefix(dayStr: string): Promise<ShadowJournalRecord[]> {
    return await this.database
      .select()
      .from(shadowJournalIndexTable)
      .where(like(shadowJournalIndexTable.date, `${dayStr}%`));
  }

  /**
   * 按精确日期查询 content_hash
   * 用于脏检测（Hash 比对判断是否需要重新解析）
   */
  async getHashByDate(dateIso: string): Promise<string | null> {
    const rows = await this.database
      .select({ contentHash: shadowJournalIndexTable.contentHash })
      .from(shadowJournalIndexTable)
      .where(eq(shadowJournalIndexTable.date, dateIso))
      .limit(1);

    return rows[0]?.contentHash ?? null;
  }

  /**
   * 获取所有索引记录（供全量扫描清理孤立索引使用）
   * 对标原版 `SELECT id, date FROM journals_index`
   */
  async getAllRecords(): Promise<Pick<ShadowJournalRecord, 'id' | 'date' | 'filePath'>[]> {
    return await this.database
      .select({
        id: shadowJournalIndexTable.id,
        date: shadowJournalIndexTable.date,
        filePath: shadowJournalIndexTable.filePath,
      })
      .from(shadowJournalIndexTable);
  }

  /**
   * 全文搜索 (journals_fts FTS5 虚拟表)
   */
  async searchFTS(query: string, limit: number = 20): Promise<ShadowFTSResult[]> {
    if (!query || query.trim().length === 0) return [];
    const cleanedQuery = query.replace(/"/g, ' ').trim();
    if (!cleanedQuery) return [];

    try {
      const rawResults = await this.database.all(
        sql`
          SELECT 
            rowid,
            snippet(journals_fts, 0, '<b>', '</b>', '...', 64) as content_snippet,
            tags,
            rank as fts_rank
          FROM journals_fts 
          WHERE journals_fts MATCH '"' || ${cleanedQuery} || '"'
          ORDER BY fts_rank ASC
          LIMIT ${limit}
        `
      ) as any[];

      return rawResults.map(row => ({
        rowid: row.rowid,
        contentSnippet: row.content_snippet,
        tags: row.tags,
        rankScore: row.fts_rank,
      }));
    } catch (e: any) {
      console.warn('[ShadowIndex] FTS 搜索失败:', e.message);
      return [];
    }
  }

  async findById(id: number): Promise<ShadowJournalRecord | null> {
    const rows = await this.database
      .select()
      .from(shadowJournalIndexTable)
      .where(eq(shadowJournalIndexTable.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByDate(dateIso: string): Promise<ShadowJournalRecord | null> {
    const rows = await this.database
      .select()
      .from(shadowJournalIndexTable)
      .where(eq(shadowJournalIndexTable.date, dateIso))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * 联合查询 journals_index + journals_fts，返回含内容的全量列表
   * 对标原版 `SELECT i.*, f.content, f.tags FROM journals_index i LEFT JOIN journals_fts f ON i.id = f.rowid`
   */
  async listAllWithFTS(options?: { limit?: number; offset?: number; orderBy?: 'asc' | 'desc' }): Promise<(ShadowJournalRecord & { rawContent: string; tagsStr: string })[]> {
    // 显式校验排序方向，防止 SQL 注入
    const direction = options?.orderBy === 'asc' ? sql.raw('ASC') : sql.raw('DESC');
    const limit = Math.max(0, Math.floor(options?.limit ?? 0));
    const offset = Math.max(0, Math.floor(options?.offset ?? 0));

    let queryStr = sql`
      SELECT i.*, f.content as rawContent, f.tags as rawTags
      FROM journals_index i
      LEFT JOIN journals_fts f ON i.id = f.rowid
      ORDER BY i.date ${direction}
    `;
    if (limit > 0) queryStr = sql`${queryStr} LIMIT ${limit}`;
    if (offset > 0) queryStr = sql`${queryStr} OFFSET ${offset}`;

    try {
      // 定义原始查询结果的行类型
      interface RawFTSRow {
        id: number;
        file_path: string;
        date: string;
        created_at: string;
        updated_at: string;
        content_hash: string;
        weather: string | null;
        mood: string | null;
        location: string | null;
        location_detail: string | null;
        is_favorite: number;
        has_media: number;
        rawContent: string | null;
        rawTags: string | null;
      }
      const rawResults = await this.database.all(queryStr) as RawFTSRow[];
      return rawResults.map(row => ({
        id: row.id,
        filePath: row.file_path,
        date: row.date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        contentHash: row.content_hash,
        weather: row.weather,
        mood: row.mood,
        location: row.location,
        locationDetail: row.location_detail,
        isFavorite: Boolean(row.is_favorite),
        hasMedia: Boolean(row.has_media),
        rawContent: row.rawContent || '',
        tagsStr: row.rawTags || '',
      }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[ShadowIndex] listAllWithFTS error:', msg);
      return [];
    }
  }

  async listAll(options?: { limit?: number; offset?: number; orderBy?: 'asc' | 'desc' }): Promise<ShadowJournalRecord[]> {
    const orderFn = options?.orderBy === 'asc'
      ? sql`${shadowJournalIndexTable.date} ASC`
      : sql`${shadowJournalIndexTable.date} DESC`;

    let query = this.database.select().from(shadowJournalIndexTable).orderBy(orderFn);

    if (options?.limit) query = query.limit(options.limit) as any;
    if (options?.offset) query = query.offset(options.offset) as any;

    return await query;
  }

  async count(): Promise<number> {
    const result = await this.database
      .select({ count: sql<number>`count(*)` })
      .from(shadowJournalIndexTable);
    return result[0]?.count || 0;
  }

  /**
   * 获取指定年份的日记活跃度数据（每天的日记数量）
   * 用于活跃热力图展示
   */
  async getActivityData(year: number): Promise<{ date: string; count: number }[]> {
    try {
      const rows = await this.database.all(
        sql`
          SELECT date, 1 as count
          FROM journals_index
          WHERE date >= ${`${year}-01-01`} AND date <= ${`${year}-12-31`}
          ORDER BY date ASC
        `
      ) as any[];
      return rows.map(row => ({ date: row.date, count: Number(row.count) || 1 }));
    } catch (e: any) {
      console.warn('[ShadowIndex] getActivityData error:', e.message);
      return [];
    }
  }
}
