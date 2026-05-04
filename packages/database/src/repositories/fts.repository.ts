// no db global import
import { sql } from 'drizzle-orm';

export interface FTSResult {
  sourceId: string; // 统一抽象结果ID (Message ID 或 Diary ID)
  sourceType: 'chat' | 'diary';
  contentSnippet: string; // MATCH 的高亮摘录
  rankScore: number; // 原生 MATCH 出来的原始秩分
}

import { AppDatabase } from '../types';

export class FTSRepository {
  constructor(private readonly database: AppDatabase) {}

  /**
   * 初始化挂载触发器和索引引擎 (需要在外壳 Boot 时调度)
   */
  async mountFTS(rawSqlString: string): Promise<void> {
    // 假设 db.run 存在，不同 driver 下略有区别，在 better-sqlite3 是 db.run()
    // 由于 drizzle 没有直接给原生执行多条 SQL 的简易方法，我们通过注入的 db 执行
    // @ts-ignore
    this.database.run(sql.raw(rawSqlString)); 
  }

  /**
   * 聊天消息全文搜索
   *
   * 仅搜索 agent_messages_fts（agent DB 内）。
   * 日记 FTS 由 ShadowIndexRepository.searchFTS() 在独立的 shadow_index.db 中处理，
   * 此处不跨库引用 diaries_fts。
   */
  async searchAll(query: string, limit: number = 20): Promise<FTSResult[]> {
    if (!query || query.trim().length === 0) return [];

    const cleanedQuery = query.replace(/"/g, ' ').trim();
    if (!cleanedQuery) return [];

    const rawMatch = sql`
      SELECT
        message_id as source_id,
        'chat' as source_type,
        snippet(agent_messages_fts, 3, '<b>', '</b>', '...', 64) as snippet,
        rank as fts_rank
      FROM agent_messages_fts WHERE agent_messages_fts MATCH '"' || ${cleanedQuery} || '"'
      ORDER BY fts_rank ASC
      LIMIT ${limit}
    `;

    const results = await this.database.all(rawMatch) as any[];

    return results.map(row => ({
      sourceId: row.source_id,
      sourceType: row.source_type,
      contentSnippet: row.snippet,
      rankScore: row.fts_rank
    }));
  }

  /**
   * 专供于纯粹只用来挖掘早期聊天信息的函数
   * 摒弃了日记干扰，单纯通过底层 FTS 去匹配聊天纪要
   */
  async searchMessages(query: string, limit: number = 20): Promise<FTSResult[]> {
    if (!query || query.trim().length === 0) return [];
    const cleanedQuery = query.replace(/"/g, ' ').trim();
    if (!cleanedQuery) return [];

    const rawMatch = sql`
      SELECT 
        message_id as source_id,
        'chat' as source_type,
        snippet(agent_messages_fts, 3, '<b>', '</b>', '...', 128) as snippet,
        rank as fts_rank
      FROM agent_messages_fts 
      WHERE agent_messages_fts MATCH '"' || ${cleanedQuery} || '"'
      ORDER BY fts_rank ASC
      LIMIT ${limit}
    `;

    const results = await this.database.all(rawMatch) as any[];

    return results.map(row => ({
      sourceId: row.source_id,
      sourceType: row.source_type,
      contentSnippet: row.snippet,
      rankScore: row.fts_rank
    }));
  }
}
