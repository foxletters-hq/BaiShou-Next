import { ToolVectorStore, ToolMessageSearcher, VectorSearchResult } from '../agent.tool'
import {
  SqliteHybridSearchRepository,
  MessageRepository,
  type AppDatabase
} from '@baishou/database'
import { formatLocalDate, formatRecallTimestamp, parseDateStr } from '@baishou/shared'

export class DatabaseAdapter implements ToolVectorStore, ToolMessageSearcher {
  constructor(
    private hybridRepo: SqliteHybridSearchRepository,
    private messageRepo: MessageRepository,
    private db: AppDatabase
  ) {}

  // --- ToolVectorStore 实现 ---

  async searchSimilar(queryEmbedding: number[], topK: number): Promise<VectorSearchResult[]> {
    const rows = await this.hybridRepo.queryNativeVector(queryEmbedding, topK)
    return rows.map((r: any) => ({
      sourceType: r.source || 'chat',
      sourceId: r.messageId,
      groupId: r.sessionId,
      chunkText: r.chunkText,
      distance: 1.0 - r.score,
      createdAt: r.createdAt
    }))
  }

  async deleteBySource(sourceType: string, sourceId: string): Promise<void> {
    await this.hybridRepo.deleteEmbeddingsBySource(sourceType, sourceId)
  }

  async deleteFile(filePath: string): Promise<void> {
    await this.hybridRepo.deleteEmbeddingsBySource('diary', filePath)
  }

  async indexFile(_filePath: string): Promise<void> {
    // 日记文件的向量索引由 ShadowIndexSyncService 的文件监听自动处理，此处为 no-op
  }

  async searchFts(query: string, limit: number) {
    const rows = await this.hybridRepo.queryFTS(query, limit)
    return rows.map((r: any) => ({
      messageId: r.messageId,
      sessionId: r.sessionId,
      snippet: r.chunkText
    }))
  }

  // --- ToolMessageSearcher 实现 ---

  async searchMessages(query: string, limit: number) {
    // 调用 MessageRepository 的全文模糊查询寻找跨越历史的回忆
    const rows = await this.messageRepo.searchMessagesByKeyword(query, limit)

    return rows.map((r: any) => ({
      role: r.role,
      snippet: r.content,
      sessionTitle: r.sessionTitle || '未命名对话',
      date: formatRecallTimestamp(r.createdAt)
    }))
  }

  // --- ToolSummaryReader 实现 ---

  async readSummary(
    type: string,
    startDateIso: string
  ): Promise<{
    content: string
    generatedAt: string
    endDateIso: string
  } | null> {
    const { eq, and } = await import('drizzle-orm')
    const { summariesTable } = await import('@baishou/database')

    const datePart = startDateIso.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
    const targetDate = datePart ? parseDateStr(datePart) : new Date(startDateIso)
    const rows = await this.db
      .select()
      .from(summariesTable)
      .where(
        and(eq(summariesTable.type as any, type as any), eq(summariesTable.startDate, targetDate))
      )
      .limit(1)

    if (rows.length === 0) return null
    const s = rows[0]!
    return {
      content: s.content,
      generatedAt: formatLocalDate(s.generatedAt),
      endDateIso: formatLocalDate(s.endDate)
    }
  }

  async getAvailableSummaries(type: string, limit: number = 5): Promise<string[]> {
    const { eq, desc } = await import('drizzle-orm')
    const { summariesTable } = await import('@baishou/database')

    const rows = await this.db
      .select({ start: summariesTable.startDate, end: summariesTable.endDate })
      .from(summariesTable)
      .where(eq(summariesTable.type as any, type as any))
      .orderBy(desc(summariesTable.startDate))
      .limit(limit)

    return rows.map(
      (r: any) => `- ${formatLocalDate(r.start)} ~ ${formatLocalDate(r.end)}`
    )
  }
}
