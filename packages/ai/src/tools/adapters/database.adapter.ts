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

  async getBySource(sourceType: string, sourceId: string, vaultId?: string) {
    const scoped = String(vaultId ?? this.tryVaultId() ?? '').trim()
    if (!scoped) return null
    return this.hybridRepo.getBySource(sourceType, sourceId, { vaultId: scoped })
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
      messageId: r.sourceId || r.messageId,
      sessionId: r.sessionId,
      snippet: r.chunkText,
      createdAt: r.createdAt,
      sourceType: r.sourceType,
      sourceId: r.sourceId != null ? String(r.sourceId) : undefined
    }))
  }

  // --- ToolMessageSearcher 实现 ---

  async searchMessages(
    query: string,
    limit: number,
    vaultId?: string,
    options?: { startDate?: string; endDate?: string; sessionId?: string }
  ) {
    const scoped = String(vaultId ?? this.tryVaultId() ?? '').trim()
    // 缺 vaultId → fail-closed，避免跨仓泄漏
    if (!scoped) return []

    const rows = await this.messageRepo.searchMessagesByKeyword(query, limit, scoped, options)

    return rows.map((r: any) => ({
      role: r.role,
      snippet: r.content,
      sessionTitle: r.sessionTitle || '未命名对话',
      date: formatRecallTimestamp(r.createdAt)
    }))
  }

  async listSessionsInDateRange(
    vaultId: string,
    startDate: string,
    endDate: string,
    limit: number
  ) {
    const scoped = String(vaultId ?? this.tryVaultId() ?? '').trim()
    if (!scoped) return []

    const rows = await this.messageRepo.listSessionsInDateRange(scoped, startDate, endDate, limit)
    return rows.map((r) => ({
      sessionId: r.sessionId,
      sessionTitle: r.sessionTitle || '未命名对话',
      firstDate: formatRecallTimestamp(r.firstCreatedAt),
      lastDate: formatRecallTimestamp(r.lastCreatedAt),
      messageCount: r.messageCount,
      preview: r.preview
    }))
  }

  async listMessagesInDateRange(
    vaultId: string,
    limit: number,
    options?: { startDate?: string; endDate?: string; sessionId?: string }
  ) {
    const scoped = String(vaultId ?? this.tryVaultId() ?? '').trim()
    if (!scoped) return []

    const rows = await this.messageRepo.listMessagesInDateRange(scoped, limit, options)
    return rows.map((r) => ({
      role: r.role,
      snippet: r.content,
      sessionTitle: r.sessionTitle || '未命名对话',
      date: formatRecallTimestamp(r.createdAt),
      sessionId: r.sessionId
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
    const dayKey = datePart ?? formatLocalDate(targetDate)
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

    let matched: (typeof rows)[number] | undefined = rows[0]
    if (!matched) {
      const candidates = await this.db
        .select()
        .from(summariesTable)
        .where(
          and(eq(summariesTable.vaultId, vaultId), eq(summariesTable.type as any, type as any))
        )
      matched = candidates.find((row) => {
        const start = row.startDate instanceof Date ? row.startDate : new Date(row.startDate)
        return formatLocalDate(start) === dayKey
      })
    }

    if (!matched) return null
    return {
      content: matched.content,
      generatedAt: formatLocalDate(matched.generatedAt),
      endDateIso: formatLocalDate(matched.endDate)
    }
  }

  async getAvailableSummaries(type: string, limit: number = 5): Promise<string[]> {
    const vaultId = this.tryVaultId()
    if (!vaultId) return []

    const rows = await this.db
      .select({ start: summariesTable.startDate, end: summariesTable.endDate })
      .from(summariesTable)
      .where(and(eq(summariesTable.vaultId, vaultId), eq(summariesTable.type as any, type as any)))
      .orderBy(desc(summariesTable.startDate))
      .limit(limit)

    return rows.map((r: any) => `- ${formatLocalDate(r.start)} ~ ${formatLocalDate(r.end)}`)
  }

  async listAllSummaries(): Promise<
    Array<{
      type: string
      startDate: Date
      endDate: Date
    }>
  > {
    const vaultId = this.tryVaultId()
    if (!vaultId) return []

    const rows = await this.db
      .select()
      .from(summariesTable)
      .where(eq(summariesTable.vaultId, vaultId))

    return rows.map((row) => ({
      type: String(row.type),
      startDate: row.startDate instanceof Date ? row.startDate : new Date(row.startDate),
      endDate: row.endDate instanceof Date ? row.endDate : new Date(row.endDate)
    }))
  }

  async writeSummary(input: {
    type: string
    startDate: Date
    endDate: Date
    content: string
  }): Promise<{ ok: true } | { ok: false; message: string }> {
    const vaultId = this.tryVaultId()
    if (!vaultId) {
      return { ok: false, message: 'No active vault ID available for writing summary.' }
    }

    try {
      const dayKey = formatLocalDate(input.startDate)
      const existingRows = await this.db
        .select()
        .from(summariesTable)
        .where(
          and(
            eq(summariesTable.vaultId, vaultId),
            eq(summariesTable.type as any, input.type as any)
          )
        )
      const sameDay = existingRows.find((row) => {
        const start = row.startDate instanceof Date ? row.startDate : new Date(row.startDate)
        return formatLocalDate(start) === dayKey
      })

      const now = new Date()
      if (sameDay?.id != null) {
        await this.db
          .update(summariesTable)
          .set({
            startDate: input.startDate,
            endDate: input.endDate,
            content: input.content,
            generatedAt: now,
            updatedAt: now
          })
          .where(eq(summariesTable.id, sameDay.id))
      } else {
        await this.db
          .insert(summariesTable)
          .values({
            vaultId,
            type: input.type as any,
            startDate: input.startDate,
            endDate: input.endDate,
            content: input.content,
            generatedAt: now
          })
          .onConflictDoUpdate({
            target: [
              summariesTable.vaultId,
              summariesTable.type,
              summariesTable.startDate,
              summariesTable.endDate
            ],
            set: {
              content: input.content,
              generatedAt: now,
              updatedAt: now
            }
          })
      }
      return { ok: true }
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : String(e)
      }
    }
  }
}
