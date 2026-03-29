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
   * 多表合并搜索 (同时匹配 Diaries 和 AgentMessages)
   */
  async searchAll(query: string, limit: number = 20): Promise<FTSResult[]> {
    if (!query || query.trim().length === 0) return [];

    // FTS5 MATCH 对于普通中文搜索常常使用双引号括起来当做 phrase 短语强制命中
    const cleanedQuery = query.replace(/"/g, ' ').trim();
    if (!cleanedQuery) return [];

    // 我们使用 UNION ALL 同时搜索 diary_fts 和 agent_messages_fts
    // 并结合 rank 返回 (注意：负数 rank 越小越匹配！)
    const rawMatch = sql`
      SELECT 
        CAST(diary_id AS TEXT) as source_id,
        'diary' as source_type,
        snippet(diaries_fts, 1, '<b>', '</b>', '...', 64) as snippet,
        rank as fts_rank
      FROM diaries_fts WHERE diaries_fts MATCH '"' || ${cleanedQuery} || '"'
      
      UNION ALL
      
      SELECT 
        message_id as source_id,
        'chat' as source_type,
        snippet(agent_messages_fts, 3, '<b>', '</b>', '...', 64) as snippet,
        rank as fts_rank
      FROM agent_messages_fts WHERE agent_messages_fts MATCH '"' || ${cleanedQuery} || '"'
      
      ORDER BY fts_rank ASC
      LIMIT ${limit}
    `;

    // 这里绕过 ORM Mapping，直接获取原始 Row 数据
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
