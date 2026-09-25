import { eq, desc, asc, and, or, sql, inArray, gte, lte, min, max } from 'drizzle-orm'
import { AgentMessageRepository } from './agent.repository'
import { AgentMessage, AgentPart, isRealLocalCalendarDate, sortAgentMessageParts } from '@baishou/shared'
import { AppDatabase } from '../types'
import { agentMessagesTable } from '../schema/agent-messages'
import { agentPartsTable } from '../schema/agent-parts'
import { agentSessionsTable } from '../schema/agent-sessions'

export function resolveLocalCalendarDayRange(
  startDate?: string,
  endDate?: string
): { start: Date; end: Date } | null {
  const parse = (value: string | undefined, endOfDay: boolean): Date | null => {
    const trimmed = (value ?? '').trim()
    if (!isRealLocalCalendarDate(trimmed)) return null
    const [yearText, monthText, dayText] = trimmed.split('-')
    const year = Number(yearText)
    const month = Number(monthText) - 1
    const day = Number(dayText)
    return endOfDay
      ? new Date(year, month, day, 23, 59, 59, 999)
      : new Date(year, month, day, 0, 0, 0, 0)
  }
  const startRaw = (startDate ?? '').trim()
  const endRaw = (endDate ?? '').trim()
  if (startRaw && !isRealLocalCalendarDate(startRaw)) return null
  if (endRaw && !isRealLocalCalendarDate(endRaw)) return null
  const start = parse(startDate, false)
  const end = parse(endDate, true)
  if (!start && !end) return null
  return {
    start: start ?? new Date(0),
    end: end ?? new Date(9999, 11, 31, 23, 59, 59, 999)
  }
}

export type InsertAgentMessageInput = Omit<AgentMessage, 'createdAt'>
export type InsertAgentPartInput = Omit<AgentPart, 'createdAt'>

export const DATE_RANGE_LIST_DEFAULT_LIMIT = 20
export const DATE_RANGE_LIST_MAX_LIMIT = 50
export const DATE_RANGE_LIST_FETCH_MAX_LIMIT = DATE_RANGE_LIST_MAX_LIMIT + 1
export const DATE_RANGE_PREVIEW_MAX_CHARS = 80
export const DATE_RANGE_SNIPPET_MAX_CHARS = 160

export type SessionInDateRangeRow = {
  sessionId: string
  sessionTitle: string
  firstCreatedAt: Date
  lastCreatedAt: Date
  messageCount: number
  preview: string
}

export type MessageInDateRangeRow = {
  role: string
  content: string
  sessionId: string
  sessionTitle: string
  createdAt: Date
}

export function clampDateListLimit(limit?: number): number {
  if (limit == null || !Number.isFinite(limit) || limit <= 0) return DATE_RANGE_LIST_DEFAULT_LIMIT
  return Math.min(Math.floor(limit), DATE_RANGE_LIST_MAX_LIMIT)
}

/** 允许比展示上限多 1 条，供工具判断截断。 */
export function clampDateListFetchLimit(limit?: number): number {
  if (limit == null || !Number.isFinite(limit) || limit <= 0) return DATE_RANGE_LIST_DEFAULT_LIMIT
  return Math.min(Math.floor(limit), DATE_RANGE_LIST_FETCH_MAX_LIMIT)
}

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
  constructor(private readonly db: AppDatabase) {}

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
    const trimmed = keyword.trim()
    const scopedVaultId = String(vaultId ?? '').trim()
    const sessionId = options?.sessionId?.trim()
    if (!trimmed || !scopedVaultId) return []
    const dateRange = resolveLocalCalendarDayRange(options?.startDate, options?.endDate)

    const [ftsResults, likeResults] = await Promise.all([
      this.searchMessagesViaFts(trimmed, limit, scopedVaultId, dateRange, sessionId),
      this.searchMessagesViaLike(trimmed, limit, scopedVaultId, dateRange, sessionId)
    ])

    const seen = new Set<string>()
    const merged: any[] = []

    for (const r of [...ftsResults, ...likeResults]) {
      const key = `${r.sessionTitle}_${r.role}_${r.content}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(r)
    }

    merged.sort((a, b) => {
      const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : Number(a.createdAt || 0)
      const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : Number(b.createdAt || 0)
      return timeB - timeA
    })

    return merged.slice(0, limit)
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
      this.isNonReasoningTextPart(),
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

  private escapeLikePattern(value: string): string {
    return `%${value.replace(/[%_\\]/g, '\\$&')}%`
  }

  private isNonReasoningTextPart() {
    return and(
      eq(agentPartsTable.type, 'text'),
      or(
        sql`json_extract(${agentPartsTable.data}, '$.isReasoning') IS NULL`,
        sql`json_extract(${agentPartsTable.data}, '$.isReasoning') = 0`,
        sql`json_extract(${agentPartsTable.data}, '$.isReasoning') = false`
      ),
      sql`LENGTH(TRIM(COALESCE(json_extract(${agentPartsTable.data}, '$.text'), ''))) > 0`
    )
  }

  private async searchMessagesViaFts(
    keyword: string,
    limit: number,
    vaultId: string,
    dateRange?: { start: Date; end: Date } | null,
    sessionId?: string
  ): Promise<any[]> {
    const cleanedQuery = keyword.replace(/"/g, ' ').trim()
    if (!cleanedQuery) return []

    try {
      const ftsMatch = sql`
        SELECT
          fts.message_id as message_id,
          snippet(agent_messages_fts, 3, '', '', '...', 160) as snippet
        FROM agent_messages_fts fts
        INNER JOIN agent_messages m ON m.id = fts.message_id
        INNER JOIN agent_sessions s ON s.id = m.session_id
        WHERE agent_messages_fts MATCH ${`"${cleanedQuery}"`}
          AND s.vault_id = ${vaultId}
          ${sessionId ? sql`AND m.session_id = ${sessionId}` : sql``}
          ${
            dateRange
              ? sql`AND m.created_at >= ${Math.floor(dateRange.start.getTime() / 1000)}
                    AND m.created_at <= ${Math.floor(dateRange.end.getTime() / 1000)}`
              : sql``
          }
        ORDER BY rank
        LIMIT ${limit * 3}
      `
      const ftsRows = (await this.db.all(ftsMatch)) as Array<{
        message_id: string
        snippet: string
      }>
      if (ftsRows.length === 0) return []

      const seen = new Set<string>()
      const results: any[] = []

      for (const row of ftsRows) {
        if (seen.has(row.message_id)) continue
        seen.add(row.message_id)

        const [messageRow] = await this.db
          .select({
            role: agentMessagesTable.role,
            createdAt: agentMessagesTable.createdAt,
            sessionTitle: agentSessionsTable.title
          })
          .from(agentMessagesTable)
          .innerJoin(agentSessionsTable, eq(agentMessagesTable.sessionId, agentSessionsTable.id))
          .where(
            and(eq(agentMessagesTable.id, row.message_id), eq(agentSessionsTable.vaultId, vaultId))
          )
          .limit(1)

        if (!messageRow) continue
        if (dateRange) {
          const created =
            messageRow.createdAt instanceof Date
              ? messageRow.createdAt.getTime()
              : Number(messageRow.createdAt)
          const createdMs = created < 1e12 ? created * 1000 : created
          if (createdMs < dateRange.start.getTime() || createdMs > dateRange.end.getTime()) {
            continue
          }
        }

        results.push({
          role: messageRow.role,
          content: row.snippet?.replace(/<\/?b>/g, '') || '',
          sessionTitle: messageRow.sessionTitle,
          createdAt: messageRow.createdAt
        })

        if (results.length >= limit) break
      }

      return results
    } catch {
      return []
    }
  }

  private async searchMessagesViaLike(
    keyword: string,
    limit: number,
    vaultId: string,
    dateRange?: { start: Date; end: Date } | null,
    sessionId?: string
  ): Promise<any[]> {
    const pattern = this.escapeLikePattern(keyword)
    const rows = await this.db
      .select({
        messageId: agentMessagesTable.id,
        role: agentMessagesTable.role,
        content: agentPartsTable.data,
        partType: agentPartsTable.type,
        createdAt: agentMessagesTable.createdAt,
        sessionTitle: agentSessionsTable.title
      })
      .from(agentMessagesTable)
      .innerJoin(agentPartsTable, eq(agentMessagesTable.id, agentPartsTable.messageId))
      .innerJoin(agentSessionsTable, eq(agentMessagesTable.sessionId, agentSessionsTable.id))
      .where(
        and(
          eq(agentSessionsTable.vaultId, vaultId),
          ...(sessionId ? [eq(agentMessagesTable.sessionId, sessionId)] : []),
          ...(dateRange
            ? [
                gte(agentMessagesTable.createdAt, dateRange.start),
                lte(agentMessagesTable.createdAt, dateRange.end)
              ]
            : []),
          or(
            and(
              this.isNonReasoningTextPart(),
              sql`json_extract(${agentPartsTable.data}, '$.text') LIKE ${pattern} ESCAPE '\\'`
            ),
            and(
              eq(agentPartsTable.type, 'attachment'),
              sql`json_extract(${agentPartsTable.data}, '$.textContent') LIKE ${pattern} ESCAPE '\\'`
            )
          )
        )
      )
      .orderBy(desc(agentMessagesTable.createdAt))
      .limit(limit * 4)

    const seen = new Set<string>()
    const results: any[] = []

    for (const r of rows) {
      if (seen.has(r.messageId)) continue
      seen.add(r.messageId)

      const data = r.content as any
      const snippet =
        r.partType === 'attachment'
          ? (data?.textContent as string) || ''
          : (data?.text as string) || ''

      results.push({
        role: r.role,
        content: snippet,
        sessionTitle: r.sessionTitle,
        createdAt: r.createdAt
      })

      if (results.length >= limit) break
    }

    return results
  }
}
