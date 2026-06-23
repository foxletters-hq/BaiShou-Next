import { eq, desc, or, sql, and, inArray } from 'drizzle-orm'
import type { AppDatabase } from '../types'
import { agentSessionsTable } from '../schema/agent-sessions'
import { agentMessagesTable as messagesTbl } from '../schema/agent-messages'
import { agentPartsTable as partsTbl } from '../schema/agent-parts'
import type { InsertSessionInput } from './session.repository.types'
import { usesSyncTransaction } from './session.repository.utils'

export class SessionCrudOps {
  constructor(private readonly db: AppDatabase) {}

  async upsertSession(input: InsertSessionInput): Promise<void> {
    const vaultName = input.vaultName || 'default'
    const providerId = input.providerId || 'default'
    const modelId = input.modelId || 'default'

    await this.db
      .insert(agentSessionsTable)
      .values({
        id: input.id,
        title: input.title,
        vaultName: vaultName,
        assistantId: input.assistantId,
        systemPrompt: input.systemPrompt,
        providerId: providerId,
        modelId: modelId,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [agentSessionsTable.id],
        set: {
          title: input.title,
          updatedAt: new Date(),
          ...(input.assistantId ? { assistantId: input.assistantId } : {}),
          ...(input.providerId ? { providerId } : {}),
          ...(input.modelId ? { modelId } : {})
        }
      })
  }

  async updateTokenUsage(
    id: string,
    inputTokens: number,
    outputTokens: number,
    costMicros: number = 0,
    cacheReadInputTokens: number = 0,
    cacheWriteInputTokens: number = 0
  ): Promise<void> {
    await this.db
      .update(agentSessionsTable)
      .set({
        totalInputTokens: sql`${agentSessionsTable.totalInputTokens} + ${inputTokens}`,
        totalOutputTokens: sql`${agentSessionsTable.totalOutputTokens} + ${outputTokens}`,
        totalCacheReadInputTokens: sql`${agentSessionsTable.totalCacheReadInputTokens} + ${cacheReadInputTokens}`,
        totalCacheWriteInputTokens: sql`${agentSessionsTable.totalCacheWriteInputTokens} + ${cacheWriteInputTokens}`,
        totalCostMicros: sql`${agentSessionsTable.totalCostMicros} + ${costMicros}`,
        updatedAt: new Date()
      })
      .where(eq(agentSessionsTable.id, id))
  }

  async findAllSessions(
    limit: number = 20,
    offset: number = 0,
    assistantId?: string,
    searchQuery?: string
  ) {
    let matchedSessionIds: string[] = []

    if (searchQuery && searchQuery.trim()) {
      const cleaned = searchQuery.replace(/"/g, ' ').trim()
      const pattern = `%${searchQuery.replace(/[%_\\]/g, '\\$&')}%`
      const sessionIdsSet = new Set<string>()

      const tasks: Promise<void>[] = []

      // 1. 尝试使用 FTS 快速查询匹配的会话 ID
      if (cleaned) {
        tasks.push(
          (async () => {
            try {
              const ftsRows = await this.db.all(sql`
                SELECT DISTINCT session_id as sessionId
                FROM agent_messages_fts
                WHERE agent_messages_fts MATCH ${`"${cleaned}"`}
              `)
              ftsRows
                .map((r: any) => r.sessionId)
                .filter(Boolean)
                .forEach((id: string) => sessionIdsSet.add(id))
            } catch (e) {
              console.warn('[SessionRepo] FTS search failed:', e)
            }
          })()
        )
      }

      // 2. 无论 FTS 结果如何，都使用 LIKE 模糊查询补充
      tasks.push(
        (async () => {
          try {
            const likeRows = await this.db
              .select({ sessionId: partsTbl.sessionId })
              .from(partsTbl)
              .where(
                and(
                  eq(partsTbl.type, 'text'),
                  or(
                    sql`json_extract(${partsTbl.data}, '$.isReasoning') IS NULL`,
                    sql`json_extract(${partsTbl.data}, '$.isReasoning') = 0`,
                    sql`json_extract(${partsTbl.data}, '$.isReasoning') = false`,
                    sql`json_extract(${partsTbl.data}, '$.isReasoning') = 'false'`
                  ),
                  sql`json_extract(${partsTbl.data}, '$.text') LIKE ${pattern} ESCAPE '\\'`
                )
              )
            likeRows
              .map((r: any) => r.sessionId)
              .filter(Boolean)
              .forEach((id: string) => sessionIdsSet.add(id))
          } catch (e) {
            console.error('[SessionRepo] LIKE message search failed:', e)
          }
        })()
      )

      await Promise.all(tasks)
      matchedSessionIds = Array.from(sessionIdsSet)
    }

    let q = this.db.select().from(agentSessionsTable)

    // 组合过滤条件
    const conditions: any[] = []

    const normalizedAssistantId = assistantId?.trim()
    if (normalizedAssistantId) {
      conditions.push(eq(agentSessionsTable.assistantId, normalizedAssistantId))
    }

    if (searchQuery && searchQuery.trim()) {
      const titlePattern = `%${searchQuery.replace(/[%_\\]/g, '\\$&')}%`
      const titleCond = sql`${agentSessionsTable.title} LIKE ${titlePattern} ESCAPE '\\'`

      if (matchedSessionIds.length > 0) {
        conditions.push(or(titleCond, inArray(agentSessionsTable.id, matchedSessionIds)))
      } else {
        conditions.push(titleCond)
      }
    }

    if (conditions.length > 0) {
      if (conditions.length === 1) {
        q = q.where(conditions[0]!) as any
      } else {
        q = q.where(and(...conditions)) as any
      }
    }

    let finalQuery: any = q.orderBy(
      desc(agentSessionsTable.isPinned),
      desc(agentSessionsTable.updatedAt)
    )

    if (limit > 0) {
      finalQuery = finalQuery.limit(limit).offset(offset)
    }

    const results = await finalQuery
    console.log(
      `[SessionRepo] findAllSessions(limit=${limit}, offset=${offset}, astId=${assistantId}, query=${searchQuery}) => returned ${results.length} rows.`
    )
    if (results.length === 0 && !searchQuery && normalizedAssistantId) {
      const allDocs = await this.db.select().from(agentSessionsTable)
      console.log(`[SessionRepo] WARNING: Returned 0, but total rows in DB: ${allDocs.length}`)
      if (allDocs.length > 0) {
        const sampleIds = [...new Set(allDocs.map((row) => row.assistantId ?? '(null)'))].slice(
          0,
          5
        )
        console.log(
          `[SessionRepo] assistantId filter=${normalizedAssistantId}, sample assistant_ids in DB:`,
          sampleIds
        )
      }
    }
    return results
  }

  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    await this.db
      .update(agentSessionsTable)
      .set({ title, updatedAt: new Date() })
      .where(eq(agentSessionsTable.id, sessionId))
  }

  async deleteSessions(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const { inArray } = await import('drizzle-orm')
    if (usesSyncTransaction(this.db)) {
      await (this.db as any).transaction((tx: any) => {
        tx.delete(agentSessionsTable).where(inArray(agentSessionsTable.id, ids)).run()
        tx.delete(messagesTbl).where(inArray(messagesTbl.sessionId, ids)).run()
        tx.delete(partsTbl).where(inArray(partsTbl.sessionId, ids)).run()
      })
    } else {
      await this.db.transaction(async (tx) => {
        await tx.delete(agentSessionsTable).where(inArray(agentSessionsTable.id, ids))
        await tx.delete(messagesTbl).where(inArray(messagesTbl.sessionId, ids))
        await tx.delete(partsTbl).where(inArray(partsTbl.sessionId, ids))
      })
    }
  }

  async getSessionById(sessionId: string): Promise<any> {
    const docs = await this.db
      .select()
      .from(agentSessionsTable)
      .where(eq(agentSessionsTable.id, sessionId))
      .limit(1)
    return docs.length > 0 ? docs[0] : null
  }

  async togglePin(id: string, isPinned: boolean): Promise<void> {
    await this.db
      .update(agentSessionsTable)
      .set({ isPinned, updatedAt: new Date() })
      .where(eq(agentSessionsTable.id, id))
  }

  async updatePartsDataFallback(partIds: string[], fallbackData: any): Promise<void> {
    if (partIds.length === 0) return
    const { inArray } = await import('drizzle-orm')
    await this.db.update(partsTbl).set({ data: fallbackData }).where(inArray(partsTbl.id, partIds))
  }
}
