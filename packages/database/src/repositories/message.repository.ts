import { eq, desc, asc, and, sql, inArray, gte, lte, min, max } from 'drizzle-orm'
import { AgentMessageRepository } from './agent.repository'
import {
  AgentMessage,
  AgentPart,
  isRealLocalCalendarDate,
  sortAgentMessageParts
} from '@baishou/shared'
import { AppDatabase } from '../types'
import { agentMessagesTable } from '../schema/agent-messages'
import { agentPartsTable } from '../schema/agent-parts'
import { agentSessionsTable } from '../schema/agent-sessions'
import {
  DATE_RANGE_LIST_DEFAULT_LIMIT,
  DATE_RANGE_LIST_FETCH_MAX_LIMIT,
  DATE_RANGE_LIST_MAX_LIMIT,
  DATE_RANGE_PREVIEW_MAX_CHARS,
  DATE_RANGE_SNIPPET_MAX_CHARS,
  clampDateListFetchLimit,
  clampDateListLimit,
  resolveLocalCalendarDayRange,
  type MessageInDateRangeRow,
  type SessionInDateRangeRow
} from './message.repository.date-range'
import { MessageSearchOps, isNonReasoningTextPart } from './message.repository.search'

export {
  DATE_RANGE_LIST_DEFAULT_LIMIT,
  DATE_RANGE_LIST_FETCH_MAX_LIMIT,
  DATE_RANGE_LIST_MAX_LIMIT,
  DATE_RANGE_PREVIEW_MAX_CHARS,
  DATE_RANGE_SNIPPET_MAX_CHARS,
  clampDateListFetchLimit,
  clampDateListLimit,
  resolveLocalCalendarDayRange
}
export type { MessageInDateRangeRow, SessionInDateRangeRow }

export type InsertAgentMessageInput = Omit<AgentMessage, 'createdAt'>
export type InsertAgentPartInput = Omit<AgentPart, 'createdAt'>

function toMessageDate(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return new Date(0)
  return new Date(n < 1e12 ? n * 1000 : n)
}

function extractTextPartBody(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const text = (data as { text?: unknown }).text
  return typeof text === 'string' ? text.trim() : ''
}

function truncatePreview(text: string, max = DATE_RANGE_PREVIEW_MAX_CHARS): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max)}...`
}

export class MessageRepository implements AgentMessageRepository {
  private readonly db: AppDatabase
  private readonly search: MessageSearchOps

  constructor(db: AppDatabase) {
    this.db = db
    this.search = new MessageSearchOps(db)
  }

  async findBySessionId(
    sessionId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<AgentMessage[]> {
    const rows = await this.db
      .select()
      .from(agentMessagesTable)
      .where(eq(agentMessagesTable.sessionId, sessionId))
      .orderBy(desc(agentMessagesTable.orderIndex))
      .limit(limit)
      .offset(offset)

    return rows.reverse().map((row) => ({
      ...row,
      role: row.role as AgentMessage['role'],
      askId: row.askId ?? undefined,
      providerId: row.providerId ?? undefined,
      modelId: row.modelId ?? undefined,
      inputTokens: row.inputTokens ?? undefined,
      outputTokens: row.outputTokens ?? undefined,
      cacheReadInputTokens: row.cacheReadInputTokens ?? undefined,
      cacheWriteInputTokens: row.cacheWriteInputTokens ?? undefined,
      costMicros: row.costMicros ?? undefined,
      createdAt: row.createdAt
    }))
  }

  async getPartsByMessageId(messageId: string): Promise<AgentPart[]> {
    const rows = await this.db
      .select()
      .from(agentPartsTable)
      .where(eq(agentPartsTable.messageId, messageId))
      .orderBy(asc(agentPartsTable.createdAt))

    return rows.map((r) => ({
      ...r,
      type: r.type as AgentPart['type']
    }))
  }

  async getPartsByMessageIds(messageIds: string[]): Promise<AgentPart[]> {
    if (messageIds.length === 0) return []

    const rows = await this.db
      .select()
      .from(agentPartsTable)
      .where(inArray(agentPartsTable.messageId, messageIds))
      .orderBy(asc(agentPartsTable.createdAt))

    const mapped = rows.map((r) => ({
      ...r,
      type: r.type as AgentPart['type']
    }))
    // 按 messageId 分组后再按 seq / 类型兜底排序，避免同秒 createdAt 打乱时间线
    const byMessage = new Map<string, typeof mapped>()
    for (const part of mapped) {
      const bucket = byMessage.get(part.messageId)
      if (bucket) bucket.push(part)
      else byMessage.set(part.messageId, [part])
    }
    const ordered: typeof mapped = []
    const seen = new Set<string>()
    for (const id of messageIds) {
      const bucket = byMessage.get(id)
      if (!bucket) continue
      seen.add(id)
      ordered.push(...sortAgentMessageParts(bucket))
    }
    for (const [id, bucket] of byMessage) {
      if (!seen.has(id)) ordered.push(...sortAgentMessageParts(bucket))
    }
    return ordered
  }

  async create(input: InsertAgentMessageInput): Promise<AgentMessage> {
    const [inserted] = await this.db
      .insert(agentMessagesTable)
      .values({
        id: input.id,
        sessionId: input.sessionId,
        role: input.role,
        isSummary: input.isSummary,
        askId: input.askId,
        providerId: input.providerId,
        modelId: input.modelId,
        orderIndex: input.orderIndex,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        cacheReadInputTokens: input.cacheReadInputTokens,
        cacheWriteInputTokens: input.cacheWriteInputTokens,
        costMicros: input.costMicros
      })
      .returning()

    if (!inserted) throw new Error('Failed to insert message')

    return {
      ...inserted,
      role: inserted.role as AgentMessage['role'],
      askId: inserted.askId ?? undefined,
      providerId: inserted.providerId ?? undefined,
      modelId: inserted.modelId ?? undefined,
      inputTokens: inserted.inputTokens ?? undefined,
      outputTokens: inserted.outputTokens ?? undefined,
      cacheReadInputTokens: inserted.cacheReadInputTokens ?? undefined,
      cacheWriteInputTokens: inserted.cacheWriteInputTokens ?? undefined,
      costMicros: inserted.costMicros ?? undefined
    }
  }

  async createPart(input: InsertAgentPartInput): Promise<AgentPart> {
    const [inserted] = await this.db
      .insert(agentPartsTable)
      .values({
        id: input.id,
        messageId: input.messageId,
        sessionId: input.sessionId,
        type: input.type,
        data: input.data
      })
      .returning()

    if (!inserted) throw new Error('Failed to insert message part')

    return {
      ...inserted,
      type: inserted.type as AgentPart['type']
    }
  }

  /**
   * 跨会话关键词搜索。必须带 vaultId（fail-closed），JOIN agent_sessions 过滤本仓。
   */
  async searchMessagesByKeyword(
    keyword: string,
    limit: number = 10,
    vaultId?: string | null,
    options?: { startDate?: string; endDate?: string; sessionId?: string }
  ): Promise<any[]> {
    return this.search.searchMessagesByKeyword(keyword, limit, vaultId, options)
  }

  /**
   * 按消息 created_at 聚合该时段有过用户/助手正文的会话。缺 vault 或日期非法时 fail-closed。
   */
  async listSessionsInDateRange(
    vaultId: string | null | undefined,
    startDate: string,
    endDate: string,
    limit: number = DATE_RANGE_LIST_DEFAULT_LIMIT
  ): Promise<SessionInDateRangeRow[]> {
    const scopedVaultId = String(vaultId ?? '').trim()
    const dateRange = resolveLocalCalendarDayRange(startDate, endDate)
    if (!scopedVaultId || !dateRange || dateRange.start.getTime() > dateRange.end.getTime()) {
      return []
    }
    if (!isRealLocalCalendarDate(startDate) || !isRealLocalCalendarDate(endDate)) {
      return []
    }

    const capped = clampDateListFetchLimit(limit)
    const grouped = await this.db
      .select({
        sessionId: agentMessagesTable.sessionId,
        sessionTitle: agentSessionsTable.title,
        firstCreatedAt: min(agentMessagesTable.createdAt),
        lastCreatedAt: max(agentMessagesTable.createdAt),
        messageCount: sql<number>`count(distinct ${agentMessagesTable.id})`
      })
      .from(agentMessagesTable)
      .innerJoin(agentPartsTable, eq(agentMessagesTable.id, agentPartsTable.messageId))
      .innerJoin(agentSessionsTable, eq(agentMessagesTable.sessionId, agentSessionsTable.id))
      .where(this.dateRangeTextWhere(scopedVaultId, dateRange))
      .groupBy(agentMessagesTable.sessionId, agentSessionsTable.title)
      .orderBy(desc(sql`max(${agentMessagesTable.createdAt})`))
      .limit(capped)

    const previews = await this.loadSessionPreviews(
      scopedVaultId,
      dateRange,
      grouped.map((row) => ({
        sessionId: row.sessionId,
        firstCreatedAt: toMessageDate(row.firstCreatedAt)
      }))
    )

    return grouped.map((row) => ({
      sessionId: row.sessionId,
      sessionTitle: row.sessionTitle,
      firstCreatedAt: toMessageDate(row.firstCreatedAt),
      lastCreatedAt: toMessageDate(row.lastCreatedAt),
      messageCount: Number(row.messageCount) || 0,
      preview: previews.get(row.sessionId) ?? ''
    }))
  }

  /**
   * 按消息 created_at 列出压缩前正文片段。至少要有一个合法日期；缺 vault 时 fail-closed。
   */
  async listMessagesInDateRange(
    vaultId: string | null | undefined,
    limit: number = DATE_RANGE_LIST_DEFAULT_LIMIT,
    options?: { startDate?: string; endDate?: string; sessionId?: string }
  ): Promise<MessageInDateRangeRow[]> {
    const scopedVaultId = String(vaultId ?? '').trim()
    const startDate = options?.startDate?.trim()
    const endDate = options?.endDate?.trim()
    const sessionId = options?.sessionId?.trim()
    if (startDate && !isRealLocalCalendarDate(startDate)) return []
    if (endDate && !isRealLocalCalendarDate(endDate)) return []
    const dateRange = resolveLocalCalendarDayRange(startDate, endDate)
    if (!scopedVaultId || !dateRange || dateRange.start.getTime() > dateRange.end.getTime()) {
      return []
    }

    const capped = clampDateListFetchLimit(limit)
    const rows = await this.db
      .select({
        messageId: agentMessagesTable.id,
        sessionId: agentMessagesTable.sessionId,
        role: agentMessagesTable.role,
        content: agentPartsTable.data,
        createdAt: agentMessagesTable.createdAt,
        sessionTitle: agentSessionsTable.title
      })
      .from(agentMessagesTable)
      .innerJoin(agentPartsTable, eq(agentMessagesTable.id, agentPartsTable.messageId))
      .innerJoin(agentSessionsTable, eq(agentMessagesTable.sessionId, agentSessionsTable.id))
      .where(this.dateRangeTextWhere(scopedVaultId, dateRange, sessionId))
      .orderBy(desc(agentMessagesTable.createdAt))
      .limit(capped * 4)

    const seen = new Set<string>()
    const results: MessageInDateRangeRow[] = []
    for (const row of rows) {
      if (seen.has(row.messageId)) continue
      const text = extractTextPartBody(row.content)
      if (!text) continue
      seen.add(row.messageId)
      results.push({
        role: row.role,
        content: truncatePreview(text, DATE_RANGE_SNIPPET_MAX_CHARS),
        sessionId: row.sessionId,
        sessionTitle: row.sessionTitle,
        createdAt: toMessageDate(row.createdAt)
      })
      if (results.length >= capped) break
    }

    return results
  }

  private dateRangeTextWhere(
    vaultId: string,
    dateRange: { start: Date; end: Date },
    sessionId?: string
  ) {
    return and(
      eq(agentSessionsTable.vaultId, vaultId),
      inArray(agentMessagesTable.role, ['user', 'assistant']),
      gte(agentMessagesTable.createdAt, dateRange.start),
      lte(agentMessagesTable.createdAt, dateRange.end),
      isNonReasoningTextPart(),
      ...(sessionId ? [eq(agentMessagesTable.sessionId, sessionId)] : [])
    )
  }

  private async loadSessionPreviews(
    vaultId: string,
    dateRange: { start: Date; end: Date },
    sessions: Array<{ sessionId: string; firstCreatedAt: Date }>
  ): Promise<Map<string, string>> {
    const previews = new Map<string, string>()
    if (sessions.length === 0) return previews

    const rows = await this.db
      .select({
        sessionId: agentMessagesTable.sessionId,
        content: agentPartsTable.data
      })
      .from(agentMessagesTable)
      .innerJoin(agentPartsTable, eq(agentMessagesTable.id, agentPartsTable.messageId))
      .innerJoin(agentSessionsTable, eq(agentMessagesTable.sessionId, agentSessionsTable.id))
      .where(
        and(
          this.dateRangeTextWhere(vaultId, dateRange),
          inArray(
            agentMessagesTable.sessionId,
            sessions.map((session) => session.sessionId)
          ),
          inArray(
            agentMessagesTable.createdAt,
            sessions.map((session) => session.firstCreatedAt)
          )
        )
      )
      .orderBy(asc(agentMessagesTable.createdAt))

    for (const row of rows) {
      if (previews.has(row.sessionId)) continue
      const text = extractTextPartBody(row.content)
      if (!text) continue
      previews.set(row.sessionId, truncatePreview(text))
    }
    return previews
  }
}
