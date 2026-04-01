import { eq, sql, like } from 'drizzle-orm';
import { shadowJournalIndexTable, SHADOW_INDEX_FTS_INIT_SQL, SHADOW_INDEX_FTS_FALLBACK_SQL } from '../schema/shadow-index';
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
 * 像素级还原原版 `ShadowIndexDatabase` 的全部 CRUD 能力，
 * 并增加 FTS5 初始化和全文搜索方法。
 * 
 * 核心设计理念：
 * - 影子索引是可被安全重建的——它只是物理文件的元数据镜像
 * - FTS5 表跟随影子索引同步更新，确保全文搜索始终一致
 * - 所有方法都通过注入的 AppDatabase 操作，不持有全局单例
 */
export class ShadowIndexRepository {
  constructor(private readonly database: AppDatabase) {}

  /**
   * 初始化 FTS5 虚拟表
   * 优先尝试 FTS5，不支持时回退到普通表
   * 
   * 对标原版 `_onCreate()` 和 `_onUpgrade()` 中的 FTS 逻辑
   */
  async mountFTS(): Promise<void> {
    try {
      // @ts-ignore - drizzle 不直接暴露 run 给 raw SQL
      this.database.run(sql.raw(SHADOW_INDEX_FTS_INIT_SQL));
    } catch (e: any) {
      console.warn('[ShadowIndex] FTS5 不受支持，回退到普通表:', e.message);
      try {
        // @ts-ignore
        this.database.run(sql.raw('DROP TABLE IF EXISTS shadow_journal_fts'));
      } catch (_) { /* ignore */ }
      // @ts-ignore
      this.database.run(sql.raw(SHADOW_INDEX_FTS_FALLBACK_SQL));
    }
  }

  /**
   * 插入或更新单条日记的影子索引记录
   * 
   * 对标原版 `upsertJournalIndex()` —— 同时维护主表和 FTS 表
   */
  async upsert(payload: UpsertShadowIndexPayload): Promise<number> {
    const { rawContent, tags, ...indexData } = payload;

    // 1. Upsert 主索引表
    const result = await this.database
      .insert(shadowJournalIndexTable)
      .values(indexData)
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
        },
      })
      .returning({ id: shadowJournalIndexTable.id });

    const rowId = result[0]?.id;
    if (rowId == null) {
      throw new Error('[ShadowIndex] upsert 返回了空 ID');
    }

    // 2. FTS 同步（先删后插，保证幂等性）
    try {
      // @ts-ignore
      this.database.run(
        sql`DELETE FROM shadow_journal_fts WHERE rowid = ${rowId}`
      );
      // @ts-ignore
      this.database.run(
        sql`INSERT INTO shadow_journal_fts(rowid, content, tags) VALUES(${rowId}, ${rawContent}, ${tags})`
      );
    } catch (e: any) {
      console.warn('[ShadowIndex] FTS 同步失败 (非阻塞):', e.message);
    }

    return rowId;
  }

  /**
   * 删除指定 ID 的影子索引记录
   * 对标原版 `deleteJournalIndex()`
   */
  async deleteById(id: number): Promise<void> {
    await this.database
      .delete(shadowJournalIndexTable)
      .where(eq(shadowJournalIndexTable.id, id));

    try {
      // @ts-ignore
      this.database.run(
        sql`DELETE FROM shadow_journal_fts WHERE rowid = ${id}`
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
   * 全文搜索
   * 在影子索引的 FTS5 虚拟表中执行全文检索
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
            snippet(shadow_journal_fts, 0, '<b>', '</b>', '...', 64) as content_snippet,
            tags,
            rank as fts_rank
          FROM shadow_journal_fts 
          WHERE shadow_journal_fts MATCH '"' || ${cleanedQuery} || '"'
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

  /**
   * 专为业务层提供的辅助查询
   */
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
}
