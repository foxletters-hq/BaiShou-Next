import { ToolVectorStore, ToolMessageSearcher, VectorSearchResult } from '../agent.tool'
import {
  SqliteHybridSearchRepository,
  MessageRepository,
  summariesTable,
  type AppDatabase
} from '@baishou/database'
import { eq, and, desc } from 'drizzle-orm'
import { formatLocalDate, formatRecallTimestamp, parseDateStr } from '@baishou/shared'

export class DatabaseAdapter implements ToolVectorStore, ToolMessageSearcher {
  constructor(
    private hybridRepo: SqliteHybridSearchRepository,
    private messageRepo: MessageRepository,
    private db: AppDatabase,
    /** 活跃仓库 ID；总结查询 fail-closed */
    private resolveVaultId?: () => string | null | undefined
  ) {}

  private tryVaultId(): string | null {
    const id = String(this.resolveVaultId?.() ?? '').trim()
    return id || null
  }

  // --- ToolVectorStore 实现 ---

  async searchSimilar(
    queryEmbedding: number[],
    topK: number,
    timeFilter?: { startMs?: number; endMs?: number; vaultId?: string }
  ): Promise<VectorSearchResult[]> {
    const rows = await this.hybridRepo.queryNativeVector(queryEmbedding, topK, {
      startMs: timeFilter?.startMs,
      endMs: timeFilter?.endMs,
      vaultId: timeFilter?.vaultId
    })
    return rows.map((r: any) => ({
      sourceType: r.sourceType || r.source || 'chat',
      sourceId: r.sourceId || r.messageId,
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

  async searchFts(
    query: string,
    limit: number,
    timeFilter?: { startMs?: number; endMs?: number; vaultId?: string }
  ) {
    const rows = await this.hybridRepo.queryFTS(query, limit, {
      startMs: timeFilter?.startMs,
      endMs: timeFilter?.endMs,
      vaultId: timeFilter?.vaultId
    })
    return rows.map((r: any) => ({
      messageId: r.messageId,
      sessionId: r.sessionId,
      snippet: r.chunkText,
      createdAt: r.createdAt
    }))
  }

  // --- ToolMessageSearcher 实现 ---

  async searchMessages(query: string, limit: number, vaultId?: string) {
    const scoped = String(vaultId ?? this.tryVaultId() ?? '').trim()
    // 缺 vaultId → fail-closed，避免跨仓泄漏
    if (!scoped) return []

    const rows = await this.messageRepo.searchMessagesByKeyword(query, limit, scoped)

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
    const vaultId = this.tryVaultId()
    if (!vaultId) return null

    const datePart = startDateIso.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
    const targetDate = datePart ? parseDateStr(datePart) : new Date(startDateIso)
    const rows = await this.db
      .select()
      .from(summariesTable)
      .where(
        and(
          eq(summariesTable.vaultId, vaultId),
          eq(summariesTable.type as any, type as any),
          eq(summariesTable.startDate, targetDate)
        )
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
    const vaultId = this.tryVaultId()
    if (!vaultId) return []

    const rows = await this.db
      .select({ start: summariesTable.startDate, end: summariesTable.endDate })
      .from(summariesTable)
      .where(
        and(eq(summariesTable.vaultId, vaultId), eq(summariesTable.type as any, type as any))
      )
      .orderBy(desc(summariesTable.startDate))
      .limit(limit)

    return rows.map((r: any) => `- ${formatLocalDate(r.start)} ~ ${formatLocalDate(r.end)}`)
  }
}
