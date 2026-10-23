import { and, desc, eq, gte, lte, or, sql } from 'drizzle-orm'
import type { AppDatabase } from '../types'
import { agentMessagesTable } from '../schema/agent-messages'
import { agentPartsTable } from '../schema/agent-parts'
import { agentSessionsTable } from '../schema/agent-sessions'
import { resolveLocalCalendarDayRange } from './message.repository.date-range'

/** 只把非推理、正文非空的 text part 视为可检索内容。 */
export function isNonReasoningTextPart() {
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

function escapeLikePattern(value: string): string {
  return `%${value.replace(/[%_\\]/g, '\\$&')}%`
}

export class MessageSearchOps {
  constructor(private readonly db: AppDatabase) {}

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
    const pattern = escapeLikePattern(keyword)
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
              isNonReasoningTextPart(),
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
