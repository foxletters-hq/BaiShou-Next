import { eq, desc, and, gte, gt, inArray } from 'drizzle-orm'
import type { AppDatabase } from '../types'
import { agentSessionsTable } from '../schema/agent-sessions'
import { agentMessagesTable as messagesTbl } from '../schema/agent-messages'
import { agentPartsTable as partsTbl } from '../schema/agent-parts'
import type { InsertMessageInput, InsertPartInput } from './session.repository.types'
import { generateSessionUUID, usesSyncTransaction } from './session.repository.utils'

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
    if (usesSyncTransaction(this.db)) {
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
            cacheReadInputTokens: message.cacheReadInputTokens,
            cacheWriteInputTokens: message.cacheWriteInputTokens,
            costMicros: message.costMicros,
            providerId: message.providerId,
            modelId: message.modelId,
            createdAt: new Date()
          })
          .onConflictDoNothing()
          .run()

        if (parts.length > 0) {
          // integer timestamp 存秒；按 part 下标递增，避免同秒导致 ORDER BY createdAt 失序
          const baseSec = Math.floor(Date.now() / 1000)
          tx.insert(partsTbl)
            .values(
              parts.map((p, index) => ({
                id: p.id,
                messageId: p.messageId,
                sessionId: p.sessionId,
                type: p.type,
                data: p.data,
                createdAt: new Date((baseSec + index) * 1000)
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
            cacheReadInputTokens: message.cacheReadInputTokens,
            cacheWriteInputTokens: message.cacheWriteInputTokens,
            costMicros: message.costMicros,
            providerId: message.providerId,
            modelId: message.modelId,
            createdAt: new Date()
          })
          .onConflictDoNothing()

        if (parts.length > 0) {
          const baseSec = Math.floor(Date.now() / 1000)
          await tx.insert(partsTbl).values(
            parts.map((p, index) => ({
              id: p.id,
              messageId: p.messageId,
              sessionId: p.sessionId,
              type: p.type,
              data: p.data,
              createdAt: new Date((baseSec + index) * 1000)
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

  async getMessagesBySession(sessionId: string, limit: number = 50, offset: number = 0) {
    const rawMessages = await this.db
      .select()
      .from(messagesTbl)
      .where(eq(messagesTbl.sessionId, sessionId))
      .orderBy(desc(messagesTbl.orderIndex))
      .limit(limit)
      .offset(offset)

    rawMessages.reverse()

    if (rawMessages.length === 0) return []

    const messageIds = rawMessages.map((msg) => msg.id)
    const allParts = await this.db
      .select()
      .from(partsTbl)
      .where(and(eq(partsTbl.sessionId, sessionId), inArray(partsTbl.messageId, messageIds)))

    const partsByMessageId = new Map<string, typeof allParts>()
    for (const part of allParts) {
      const bucket = partsByMessageId.get(part.messageId)
      if (bucket) bucket.push(part)
      else partsByMessageId.set(part.messageId, [part])
    }

    for (const [, bucket] of partsByMessageId) {
      bucket.sort((a, b) => {
        const readSeq = (data: unknown): number => {
          const obj =
            typeof data === 'string'
              ? (() => {
                  try {
                    return JSON.parse(data) as { seq?: unknown }
                  } catch {
                    return null
                  }
                })()
              : (data as { seq?: unknown } | null)
          const seq = Number(obj?.seq)
          return Number.isFinite(seq) ? seq : Number.NaN
        }
        const seqA = readSeq(a.data)
        const seqB = readSeq(b.data)
        const hasSeqA = Number.isFinite(seqA)
        const hasSeqB = Number.isFinite(seqB)
        if (hasSeqA && hasSeqB && seqA !== seqB) return seqA - seqB
        if (hasSeqA !== hasSeqB) return hasSeqA ? -1 : 1
        const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : Number(a.createdAt || 0)
        const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : Number(b.createdAt || 0)
        if (timeA !== timeB) return timeA - timeB
        return String(a.id).localeCompare(String(b.id))
      })
    }

    return rawMessages.map((msg) => ({
      ...msg,
      parts: partsByMessageId.get(msg.id) ?? []
    }))
  }

  async deleteMessage(_sessionId: string, messageId: string): Promise<void> {
    if (usesSyncTransaction(this.db)) {
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
    const ids = await this.listMessageIdsFromMessageAndFollowing(sessionId, messageId)
    if (ids.length > 0) {
      await this.deleteMessagesByIds(ids)
    }
  }

  async listMessageIdsFromMessageAndFollowing(
    sessionId: string,
    messageId: string
  ): Promise<string[]> {
    const msg = await this.db
      .select()
      .from(messagesTbl)
      .where(eq(messagesTbl.id, messageId))
      .limit(1)
    if (!msg.length) return []

    const toDelete = await this.db
      .select({ id: messagesTbl.id })
      .from(messagesTbl)
      .where(
        and(eq(messagesTbl.sessionId, sessionId), gte(messagesTbl.orderIndex, msg[0]!.orderIndex))
      )
    return toDelete.map((m) => m.id)
  }

  async listMessageIdsAfterOrderIndex(sessionId: string, orderIndex: number): Promise<string[]> {
    const toDelete = await this.db
      .select({ id: messagesTbl.id })
      .from(messagesTbl)
      .where(and(eq(messagesTbl.sessionId, sessionId), gt(messagesTbl.orderIndex, orderIndex)))
    return toDelete.map((m) => m.id)
  }

  async getPartsByMessageIds(
    messageIds: string[]
  ): Promise<Array<{ id: string; messageId: string; type: string; data: unknown }>> {
    if (messageIds.length === 0) return []
    const rows = await this.db
      .select({
        id: partsTbl.id,
        messageId: partsTbl.messageId,
        type: partsTbl.type,
        data: partsTbl.data
      })
      .from(partsTbl)
      .where(inArray(partsTbl.messageId, messageIds))
    return rows.map((row) => ({
      id: row.id,
      messageId: row.messageId,
      type: row.type,
      data: row.data
    }))
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
    const ids = await this.listMessageIdsAfterOrderIndex(sessionId, orderIndex)
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
    if (usesSyncTransaction(this.db)) {
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
