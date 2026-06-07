import type { SessionRepository, SnapshotRepository } from '@baishou/database'
import { COMPRESSION_MESSAGE_FETCH_LIMIT } from './compression.constants'

/** 截断后回滚无效压缩快照，并清除截断点起 compaction marker */
export async function reconcileCompressionStateAfterTruncate(
  sessionRepo: SessionRepository,
  snapshotRepo: SnapshotRepository,
  sessionId: string,
  clearMarkersFromOrderIndex?: number
): Promise<void> {
  if (clearMarkersFromOrderIndex !== undefined) {
    await sessionRepo.clearCompactionMarkersFromOrderIndex(sessionId, clearMarkersFromOrderIndex)
  }

  const remaining = await sessionRepo.getMessagesBySession(
    sessionId,
    COMPRESSION_MESSAGE_FETCH_LIMIT
  )

  const msgOrderMap = new Map<string, number>(remaining.map((m) => [m.id, m.orderIndex]))
  const snapshots = await snapshotRepo.listSnapshotsBySession(sessionId)

  const idsToDelete: number[] = []
  for (const snap of snapshots) {
    // 1. 如果覆盖的最新消息不存在于剩余消息中，则快照失效
    const coveredOrder = msgOrderMap.get(snap.coveredUpToMessageId)
    if (coveredOrder === undefined) {
      idsToDelete.push(snap.id)
      continue
    }

    // 2. 如果覆盖的最新消息的 orderIndex 大于或等于截断点，说明历史分叉，快照失效
    if (clearMarkersFromOrderIndex !== undefined && coveredOrder >= clearMarkersFromOrderIndex) {
      idsToDelete.push(snap.id)
      continue
    }

    // 3. 如果保留区起点消息不存在于剩余消息中，则快照失效
    if (snap.tailStartMessageId) {
      const tailOrder = msgOrderMap.get(snap.tailStartMessageId)
      if (tailOrder === undefined) {
        idsToDelete.push(snap.id)
        continue
      }
      // 4. 如果保留区起点消息的 orderIndex 大于或等于截断点，则快照失效
      if (clearMarkersFromOrderIndex !== undefined && tailOrder >= clearMarkersFromOrderIndex) {
        idsToDelete.push(snap.id)
        continue
      }
    }
  }

  if (idsToDelete.length > 0) {
    await (snapshotRepo as any).deleteSnapshots(sessionId, idsToDelete)
  }
}

/**
 * 从 cutoffOrderIndex 之后截断会话：删除后续消息、回滚无效压缩快照、清除截断点上的 compaction marker。
 * 用于重发/编辑/重新生成，确保后续压缩 UI 与上下文可被重新生成。
 */
export async function truncateSessionAfterOrderIndex(
  sessionRepo: SessionRepository,
  snapshotRepo: SnapshotRepository,
  sessionId: string,
  cutoffOrderIndex: number
): Promise<void> {
  await sessionRepo.deleteMessagesAfter(sessionId, cutoffOrderIndex)
  await reconcileCompressionStateAfterTruncate(
    sessionRepo,
    snapshotRepo,
    sessionId,
    cutoffOrderIndex
  )
}
