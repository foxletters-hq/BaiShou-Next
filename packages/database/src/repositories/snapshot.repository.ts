import { AppDatabase } from '../types'
import { compressionSnapshotsTable } from '../schema/compression-snapshots'
import { eq, desc, asc, inArray, and } from 'drizzle-orm'

export interface Snapshot {
  id: number
  sessionId: string
  summaryText: string
  coveredUpToMessageId: string
  /** 保留区起点消息 ID（tail_start_id）；旧快照为 null */
  tailStartMessageId: string | null
  messageCount: number
  tokenCount: number | null
  createdAt: Date
}

export class SnapshotRepository {
  constructor(private readonly db: AppDatabase) {}

  /**
   * 写入一条会话压缩快照（追加，不覆盖旧快照）
   * 对标原版 Flutter `appendSnapshot()`
   */
  async appendSnapshot(
    params: Omit<Snapshot, 'id' | 'createdAt' | 'tailStartMessageId'> & {
      tailStartMessageId?: string | null
    }
  ): Promise<void> {
    await this.db.insert(compressionSnapshotsTable).values({
      sessionId: params.sessionId, // TEXT UUID，直接存储，无需强转
      summaryText: params.summaryText,
      coveredUpToMessageId: params.coveredUpToMessageId, // TEXT UUID
      tailStartMessageId: params.tailStartMessageId ?? null,
      messageCount: params.messageCount,
      tokenCount: params.tokenCount ?? null,
      createdAt: new Date()
    })
  }

  /**
   * 取得指定会话最近的前情提要快照
   * 对标原版 Flutter `getLatestSnapshot()`
   */
  async listSnapshotsBySession(sessionId: string): Promise<Snapshot[]> {
    const results = await this.db
      .select()
      .from(compressionSnapshotsTable)
      .where(eq(compressionSnapshotsTable.sessionId, sessionId))
      .orderBy(asc(compressionSnapshotsTable.createdAt), asc(compressionSnapshotsTable.id))

    return results.map((result) => ({
      id: result.id,
      sessionId: result.sessionId,
      summaryText: result.summaryText,
      coveredUpToMessageId: result.coveredUpToMessageId,
      tailStartMessageId: result.tailStartMessageId ?? null,
      messageCount: result.messageCount,
      tokenCount: result.tokenCount ?? null,
      createdAt: result.createdAt
    }))
  }

  /** 原地更新已有快照（手动重新压缩，避免堆叠多条记录） */
  async updateSnapshot(
    id: number,
    params: Partial<
      Pick<
        Snapshot,
        | 'summaryText'
        | 'coveredUpToMessageId'
        | 'tailStartMessageId'
        | 'messageCount'
        | 'tokenCount'
      >
    >
  ): Promise<void> {
    const patch: Record<string, unknown> = {}
    if (params.summaryText !== undefined) patch.summaryText = params.summaryText
    if (params.coveredUpToMessageId !== undefined) {
      patch.coveredUpToMessageId = params.coveredUpToMessageId
    }
    if (params.tailStartMessageId !== undefined) {
      patch.tailStartMessageId = params.tailStartMessageId
    }
    if (params.messageCount !== undefined) patch.messageCount = params.messageCount
    if (params.tokenCount !== undefined) patch.tokenCount = params.tokenCount
    if (Object.keys(patch).length === 0) return

    await this.db
      .update(compressionSnapshotsTable)
      .set(patch)
      .where(eq(compressionSnapshotsTable.id, id))
  }

  async deleteSnapshots(sessionId: string, ids: number[]): Promise<void> {
    if (ids.length === 0) return

    await this.db
      .delete(compressionSnapshotsTable)
      .where(
        and(
          eq(compressionSnapshotsTable.sessionId, sessionId),
          inArray(compressionSnapshotsTable.id, ids)
        )
      )
  }

  /**
   * 删除 coveredUpTo 或 tailStart 引用已不存在消息的压缩快照（重发/截断后回滚）
   */
  async deleteSnapshotsNotFullyContainedInMessages(
    sessionId: string,
    remainingMessageIds: Set<string>
  ): Promise<void> {
    const snapshots = await this.listSnapshotsBySession(sessionId)
    const idsToDelete = snapshots
      .filter((snap) => {
        if (!remainingMessageIds.has(snap.coveredUpToMessageId)) return true
        if (snap.tailStartMessageId && !remainingMessageIds.has(snap.tailStartMessageId)) {
          return true
        }
        return false
      })
      .map((snap) => snap.id)

    await this.deleteSnapshots(sessionId, idsToDelete)
  }

  async getLatestSnapshot(sessionId: string): Promise<Snapshot | null> {
    const result = await this.db
      .select()
      .from(compressionSnapshotsTable)
      .where(eq(compressionSnapshotsTable.sessionId, sessionId))
      .orderBy(desc(compressionSnapshotsTable.createdAt), desc(compressionSnapshotsTable.id))
      .limit(1)
      .get()

    if (!result) return null

    return {
      id: result.id,
      sessionId: result.sessionId,
      summaryText: result.summaryText,
      coveredUpToMessageId: result.coveredUpToMessageId,
      tailStartMessageId: result.tailStartMessageId ?? null,
      messageCount: result.messageCount,
      tokenCount: result.tokenCount ?? null,
      createdAt: result.createdAt
    }
  }
}
