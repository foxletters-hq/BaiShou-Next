import { ToolVectorStore, ToolMessageSearcher, VectorSearchResult } from '../agent.tool';
import { SqliteHybridSearchRepository, MessageRepository } from '@baishou/database';

export class DatabaseAdapter implements ToolVectorStore, ToolMessageSearcher {
  constructor(
    private hybridRepo: SqliteHybridSearchRepository,
    private messageRepo: MessageRepository
  ) {}

  // --- ToolVectorStore 实现 ---

  async searchSimilar(queryEmbedding: number[], topK: number): Promise<VectorSearchResult[]> {
    if (this.hybridRepo.supportsNativeVectorSearch()) {
       const rows = await this.hybridRepo.queryNativeVector(queryEmbedding, topK);
       // 将 hybridRepo 里面的结构映射到 VectorSearchResult
       return rows.map((r: any) => ({
          sourceType: r.source || 'chat',
          sourceId: r.messageId,
          groupId: r.sessionId,
          chunkText: r.chunkText,
          distance: 1.0 - r.score, // SQLite-vec 的 distance 处理兼容 (hybridRepo 内将原生 match r.score 转为了 1-rawDist)
          createdAt: r.createdAt
       }));
    } else {
       // 当系统无原生 sqlite-vec 拓展时降级返回空（或利用内存全解算）
       console.warn('[DatabaseAdapter] No native vector search support detected, dropping similarity search.');
       return [];
    }
  }

  async deleteBySource(sourceType: string, sourceId: string): Promise<void> {
    await this.hybridRepo.deleteEmbeddingsBySource(sourceType, sourceId);
  }

  async deleteFile(filePath: string): Promise<void> {
    await this.hybridRepo.deleteEmbeddingsBySource('diary', filePath);
  }

  async indexFile(_filePath: string): Promise<void> {
    // 日记文件的向量索引由 ShadowIndexSyncService 的文件监听自动处理，此处为 no-op
  }

  async searchFts(query: string, limit: number) {
    const rows = await this.hybridRepo.queryFTS(query, limit);
    return rows.map((r: any) => ({
      messageId: r.messageId,
      sessionId: r.sessionId,
      snippet: r.chunkText
    }));
  }

  // --- ToolMessageSearcher 实现 ---

  async searchMessages(query: string, limit: number) {
    // 调用 MessageRepository 的全文模糊查询寻找跨越历史的回忆
    const rows = await this.messageRepo.searchMessagesByKeyword(query, limit);
    
    return rows.map((r: any) => ({
       role: r.role,
       snippet: r.content,
       sessionTitle: r.sessionTitle || '未命名对话',
       date: new Date(r.createdAt).toISOString().split('T')[0]
    }));
  }

  // --- ToolSummaryReader 实现 ---

  async readSummary(type: string, startDateIso: string): Promise<{ content: string; generatedAt: string, endDateIso: string } | null> {
    const { eq, and } = await import('drizzle-orm');
    const { summariesTable } = await import('@baishou/database');
    const db = (this.messageRepo as any).db; // 通过隐式取出底层连接

    const targetDate = new Date(startDateIso);
    const rows = await db.select()
        .from(summariesTable)
        .where(
            and(
               eq(summariesTable.type, type),
               eq(summariesTable.startDate, targetDate)
            )
        )
        .limit(1);

    if (rows.length === 0) return null;
    const s = rows[0];
    return {
       content: s.content,
       generatedAt: s.generatedAt.toISOString().split('T')[0],
       endDateIso: s.endDate.toISOString().split('T')[0]
    };
  }

  async getAvailableSummaries(type: string, limit: number = 5): Promise<string[]> {
    const { eq, desc } = await import('drizzle-orm');
    const { summariesTable } = await import('@baishou/database');
    const db = (this.messageRepo as any).db;

    const rows = await db.select({ start: summariesTable.startDate, end: summariesTable.endDate })
       .from(summariesTable)
       .where(eq(summariesTable.type, type))
       .orderBy(desc(summariesTable.startDate))
       .limit(limit);

    return rows.map((r: any) => `- ${r.start.toISOString().split('T')[0]} ~ ${r.end.toISOString().split('T')[0]}`);
  }
}
