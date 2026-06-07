import { eq, desc, and, gte, gt, inArray } from 'drizzle-orm'
import type { AppDatabase } from '../types'
import { agentSessionsTable } from '../schema/agent-sessions'
import { agentMessagesTable as messagesTbl } from '../schema/agent-messages'
import { agentPartsTable as partsTbl } from '../schema/agent-parts'
import type { InsertMessageInput, InsertPartInput } from './session.repository.types'
import { generateSessionUUID } from './session.repository.utils'

export interface CompactionMarkerInput {
  snapshotId?: number
  compressedAt: number
  coveredUpToMessageId?: string
  streamTranscript?: string
  streamReasoning?: string
  phase?: 'auto' | 'manual'
  status?: 'completed' | 'failed'
}

export class SessionMessageOps {
  constructor(private readonly db: AppDatabase) {}

  async insertMessageWithParts(
    message: InsertMessageInput,
    parts: InsertPartInput[]
  ): Promise<void> {
    const isBetterSqlite = (this.db as any).session?.client?.prepare !== undefined

    if (isBetterSqlite) {
      await (this.db as any).transaction((tx: any) => {
        tx.insert(messagesTbl)
          .values({
            id: message.id,
            sessionId: message.sessionId,
            role: message.role,
            isSummary: message.isSummary ?? false,
            orderIndex: message.orderIndex,
            inputTokens: message.inputTokens,
            outputTokens: message.outputTokens,
            costMicros: message.costMicros,
            providerId: message.providerId,
            modelId: message.modelId,
            createdAt: new Date()
          })
          .onConflictDoNothing()
          .run()

        if (parts.length > 0) {
          tx.insert(partsTbl)
            .values(
              parts.map((p) => ({
                id: p.id,
                messageId: p.messageId,
                sessionId: p.sessionId,
                type: p.type,
                data: p.data,
                createdAt: new Date()
              }))
            )
            .run()
        }

        tx.update(agentSessionsTable)
          .set({ updatedAt: new Date() })
          .where(eq(agentSessionsTable.id, message.sessionId))
          .run()
      })
    } else {
      await this.db.transaction(async (tx) => {
        await tx
          .insert(messagesTbl)
          .values({
            id: message.id,
            sessionId: message.sessionId,
            role: message.role,
            isSummary: message.isSummary ?? false,
            orderIndex: message.orderIndex,
            inputTokens: message.inputTokens,
            outputTokens: message.outputTokens,
            costMicros: message.costMicros,
            providerId: message.providerId,
            modelId: message.modelId,
            createdAt: new Date()
          })
          .onConflictDoNothing()

        if (parts.length > 0) {
          await tx.insert(partsTbl).values(
            parts.map((p) => ({
              id: p.id,
              messageId: p.messageId,
              sessionId: p.sessionId,
              type: p.type,
              data: p.data,
              createdAt: new Date()
            }))
          )
        }

        await tx
          .update(agentSessionsTable)
          .set({ updatedAt: new Date() })
          .where(eq(agentSessionsTable.id, message.sessionId))
      })
    }
  }

  async getMessagesBySession(sessionId: string, limit: number = 50) {
    const rawMessages = await this.db
      .select()
      .from(messagesTbl)
      .where(eq(messagesTbl.sessionId, sessionId))
      .orderBy(desc(messagesTbl.orderIndex))
      .limit(limit)

    rawMessages.reverse()

    if (rawMessages.length === 0) return []

    const allParts = await this.db.select().from(partsTbl).where(eq(partsTbl.sessionId, sessionId))

    return rawMessages.map((msg) => ({
      ...msg,
      parts: allParts.filter((p) => p.messageId === msg.id)
    }))
  }

  async deleteMessage(_sessionId: string, messageId: string): Promise<void> {
    const isBetterSqlite = (this.db as any).session?.client?.prepare !== undefined

    if (isBetterSqlite) {
      await (this.db as any).transaction((tx: any) => {
        tx.delete(partsTbl).where(eq(partsTbl.messageId, messageId)).run()
        tx.delete(messagesTbl).where(eq(messagesTbl.id, messageId)).run()
      })
    } else {
      await this.db.transaction(async (tx) => {
        await tx.delete(partsTbl).where(eq(partsTbl.messageId, messageId))
        await tx.delete(messagesTbl).where(eq(messagesTbl.id, messageId))
      })
    }
  }

  async deleteMessageAndFollowing(sessionId: string, messageId: string): Promise<void> {
    const msg = await this.db
      .select()
      .from(messagesTbl)
      .where(eq(messagesTbl.id, messageId))
      .limit(1)
    if (!msg.length) return

    const toDelete = await this.db
      .select()
      .from(messagesTbl)
      .where(
        and(eq(messagesTbl.sessionId, sessionId), gte(messagesTbl.orderIndex, msg[0]!.orderIndex))
      )
    const ids = toDelete.map((m) => m.id)
    if (ids.length > 0) {
      await this.deleteMessagesByIds(ids)
    }
  }

  async getMessageById(messageId: string): Promise<any> {
    const rows = await this.db
      .select()
      .from(messagesTbl)
      .where(eq(messagesTbl.id, messageId))
      .limit(1)
    return rows.length > 0 ? rows[0] : null
  }

  async deleteMessagesAfter(sessionId: string, orderIndex: number): Promise<void> {
    const toDelete = await this.db
      .select()
      .from(messagesTbl)
      .where(and(eq(messagesTbl.sessionId, sessionId), gt(messagesTbl.orderIndex, orderIndex)))
    const ids = toDelete.map((m) => m.id)
    if (ids.length > 0) {
      await this.deleteMessagesByIds(ids)
    }
  }

  async upsertCompactionMarker(
    sessionId: string,
    messageId: string,
    marker: CompactionMarkerInput
  ): Promise<void> {
    const existing = await this.db
      .select()
      .from(partsTbl)
      .where(and(eq(partsTbl.messageId, messageId), eq(partsTbl.type, 'compaction')))

    const data = { ...marker }

    if (existing.length > 0) {
      await this.db.update(partsTbl).set({ data }).where(eq(partsTbl.id, existing[0]!.id))
      return
    }

    await this.db.insert(partsTbl).values({
      id: generateSessionUUID(),
      messageId,
      sessionId,
      type: 'compaction',
      data,
      createdAt: new Date()
    })
  }

  async messageHasCompactionMarker(messageId: string): Promise<boolean> {
    const existing = await this.db
      .select({ id: partsTbl.id })
      .from(partsTbl)
      .where(and(eq(partsTbl.messageId, messageId), eq(partsTbl.type, 'compaction')))
      .limit(1)
    return existing.length > 0
  }

  /** 清除 orderIndex >= fromOrderIndex 的保留消息上的 compaction marker（重发/编辑截断后允许重新压缩） */
  async clearCompactionMarkersFromOrderIndex(
    sessionId: string,
    fromOrderIndex: number
  ): Promise<void> {
    const targetMessages = await this.db
      .select({ id: messagesTbl.id })
      .from(messagesTbl)
      .where(and(eq(messagesTbl.sessionId, sessionId), gte(messagesTbl.orderIndex, fromOrderIndex)))
    const messageIds = targetMessages.map((m) => m.id)
    if (messageIds.length === 0) return

    await this.db
      .delete(partsTbl)
      .where(and(inArray(partsTbl.messageId, messageIds), eq(partsTbl.type, 'compaction')))
  }

  async updateMessageTextPart(messageId: string, newText: string): Promise<void> {
    const rows = await this.db
      .select()
      .from(partsTbl)
      .where(and(eq(partsTbl.messageId, messageId), eq(partsTbl.type, 'text')))
    if (rows.length > 0) {
      await this.db
        .update(partsTbl)
        .set({ data: { text: newText } })
        .where(eq(partsTbl.id, rows[0]!.id))
    } else {
      const parent = await this.db
        .select()
        .from(messagesTbl)
        .where(eq(messagesTbl.id, messageId))
        .limit(1)
      if (parent.length > 0) {
        await this.db.insert(partsTbl).values({
          id: generateSessionUUID(),
          messageId,
          sessionId: parent[0]!.sessionId,
          type: 'text',
          data: { text: newText },
          createdAt: new Date()
        })
      }
    }
  }

  private async deleteMessagesByIds(ids: string[]): Promise<void> {
    const isBetterSqlite = (this.db as any).session?.client?.prepare !== undefined
    if (isBetterSqlite) {
      await (this.db as any).transaction((tx: any) => {
        tx.delete(partsTbl).where(inArray(partsTbl.messageId, ids)).run()
        tx.delete(messagesTbl).where(inArray(messagesTbl.id, ids)).run()
      })
    } else {
      await this.db.transaction(async (tx) => {
        await tx.delete(partsTbl).where(inArray(partsTbl.messageId, ids))
        await tx.delete(messagesTbl).where(inArray(messagesTbl.id, ids))
      })
    }
  }
}
