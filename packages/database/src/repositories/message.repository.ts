import { eq, desc, asc, and, or, sql } from 'drizzle-orm'
import { AgentMessageRepository } from './agent.repository'
import { AgentMessage, AgentPart } from '@baishou/shared'
import { AppDatabase } from '../types'
import { agentMessagesTable } from '../schema/agent-messages'
import { agentPartsTable } from '../schema/agent-parts'

export type InsertAgentMessageInput = Omit<AgentMessage, 'createdAt'>
export type InsertAgentPartInput = Omit<AgentPart, 'createdAt'>

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

  async searchMessagesByKeyword(keyword: string, limit: number = 10): Promise<any[]> {
    const trimmed = keyword.trim()
    if (!trimmed) return []

    const [ftsResults, likeResults] = await Promise.all([
      this.searchMessagesViaFts(trimmed, limit),
      this.searchMessagesViaLike(trimmed, limit)
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

  private async searchMessagesViaFts(keyword: string, limit: number): Promise<any[]> {
    const cleanedQuery = keyword.replace(/"/g, ' ').trim()
    if (!cleanedQuery) return []

    try {
      const ftsMatch = sql`
        SELECT
          fts.message_id as message_id,
          snippet(agent_messages_fts, 3, '', '', '...', 160) as snippet
        FROM agent_messages_fts fts
        WHERE agent_messages_fts MATCH ${`"${cleanedQuery}"`}
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
            sessionTitle: sql<string>`(SELECT title FROM agent_sessions WHERE id = ${agentMessagesTable.sessionId})`
          })
          .from(agentMessagesTable)
          .where(eq(agentMessagesTable.id, row.message_id))
          .limit(1)

        if (!messageRow) continue

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

  private async searchMessagesViaLike(keyword: string, limit: number): Promise<any[]> {
    const pattern = this.escapeLikePattern(keyword)
    const rows = await this.db
      .select({
        messageId: agentMessagesTable.id,
        role: agentMessagesTable.role,
        content: agentPartsTable.data,
        partType: agentPartsTable.type,
        createdAt: agentMessagesTable.createdAt,
        sessionTitle: sql<string>`(SELECT title FROM agent_sessions WHERE id = ${agentMessagesTable.sessionId})`
      })
      .from(agentMessagesTable)
      .innerJoin(agentPartsTable, eq(agentMessagesTable.id, agentPartsTable.messageId))
      .where(
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
