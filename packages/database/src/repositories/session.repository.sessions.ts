import { eq, desc, or, isNull, sql } from 'drizzle-orm'
import type { AppDatabase } from '../types'
import { agentSessionsTable } from '../schema/agent-sessions'
import { agentMessagesTable as messagesTbl } from '../schema/agent-messages'
import { agentPartsTable as partsTbl } from '../schema/agent-parts'
import type { InsertSessionInput } from './session.repository.types'

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
          updatedAt: new Date()
        }
      })
  }

  async updateTokenUsage(
    id: string,
    inputTokens: number,
    outputTokens: number,
    costMicros: number = 0
  ): Promise<void> {
    await this.db
      .update(agentSessionsTable)
      .set({
        totalInputTokens: sql`${agentSessionsTable.totalInputTokens} + ${inputTokens}`,
        totalOutputTokens: sql`${agentSessionsTable.totalOutputTokens} + ${outputTokens}`,
        totalCostMicros: sql`${agentSessionsTable.totalCostMicros} + ${costMicros}`,
        updatedAt: new Date()
      })
      .where(eq(agentSessionsTable.id, id))
  }

  async findAllSessions(limit: number = 20, offset: number = 0, assistantId?: string) {
    let q = this.db.select().from(agentSessionsTable)
    if (assistantId) {
      q = q.where(
        or(eq(agentSessionsTable.assistantId, assistantId), isNull(agentSessionsTable.assistantId))
      ) as any
    }
    const finalQuery = q
      .orderBy(desc(agentSessionsTable.isPinned), desc(agentSessionsTable.updatedAt))
      .limit(limit)
      .offset(offset)

    const results = await finalQuery
    console.log(
      `[SessionRepo] findAllSessions(limit=${limit}, offset=${offset}, astId=${assistantId}) => returned ${results.length} rows.`
    )
    if (results.length === 0) {
      const allDocs = await this.db.select().from(agentSessionsTable)
      console.log(`[SessionRepo] WARNING: Returned 0, but total rows in DB: ${allDocs.length}`)
      if (allDocs.length > 0) {
        console.log(`[SessionRepo] The first row in DB has assistantId:`, allDocs[0]!.assistantId)
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
    const isBetterSqlite = (this.db as any).session?.client?.prepare !== undefined

    if (isBetterSqlite) {
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
