import type { SnapshotRepository, Snapshot } from '@baishou/database'

export interface BranchMessageRef {
  id: string
  orderIndex: number
}

/**
 * 在分支复制的消息范围内，选取仍有效且最新的一条压缩快照。
 * （上下文构建只读 getLatestSnapshot，故只需复制这一条。）
 */
export function selectLatestSnapshotForBranch(
  snapshots: Snapshot[],
  copiedMessageIds: Set<string>,
  copiedMessages: BranchMessageRef[]
): Snapshot | null {
  let best: Snapshot | null = null

  for (const snapshot of snapshots) {
    if (!isSnapshotAnchorInCopiedSet(snapshot, copiedMessageIds, copiedMessages)) {
      continue
    }
    if (!best || snapshot.createdAt >= best.createdAt) {
      best = snapshot
    }
  }

  return best
}

export function isSnapshotAnchorInCopiedSet(
  snapshot: Snapshot,
  copiedMessageIds: Set<string>,
  copiedMessages: BranchMessageRef[]
): boolean {
  if (copiedMessageIds.has(snapshot.coveredUpToMessageId)) {
    return true
  }

  const orderIdx = Number(snapshot.coveredUpToMessageId)
  if (Number.isNaN(orderIdx)) {
    return false
  }

  return copiedMessages.some((m) => m.orderIndex === orderIdx)
}

/**
 * 将快照锚点映射到分支会话中的新消息 ID（兼容历史误存 orderIndex 的快照）。
 */
export function remapSnapshotAnchorToBranch(
  snapshot: Snapshot,
  oldToNewMessageId: Map<string, string>,
  copiedMessages: BranchMessageRef[]
): string | null {
  const direct = oldToNewMessageId.get(snapshot.coveredUpToMessageId)
  if (direct) return direct

  const orderIdx = Number(snapshot.coveredUpToMessageId)
  if (Number.isNaN(orderIdx)) {
    return null
  }

  const sourceMsg = copiedMessages.find((m) => m.orderIndex === orderIdx)
  if (!sourceMsg) {
    return null
  }

  return oldToNewMessageId.get(sourceMsg.id) ?? null
}

/**
 * 分支创建时复制仍适用的压缩快照，使新会话与分叉点处的上下文行为一致。
 */
export async function copyBranchCompressionSnapshots(
  snapshotRepo: SnapshotRepository,
  sourceSessionId: string,
  newSessionId: string,
  oldToNewMessageId: Map<string, string>,
  copiedMessages: BranchMessageRef[]
): Promise<boolean> {
  const snapshots = await snapshotRepo.listSnapshotsBySession(sourceSessionId)
  if (snapshots.length === 0) {
    return false
  }

  const copiedIds = new Set(copiedMessages.map((m) => m.id))
  const snapshotToCopy = selectLatestSnapshotForBranch(snapshots, copiedIds, copiedMessages)
  if (!snapshotToCopy) {
    return false
  }

  const newAnchorId = remapSnapshotAnchorToBranch(
    snapshotToCopy,
    oldToNewMessageId,
    copiedMessages
  )
  if (!newAnchorId) {
    return false
  }

  const newTailStartId = snapshotToCopy.tailStartMessageId
    ? (oldToNewMessageId.get(snapshotToCopy.tailStartMessageId) ?? null)
    : null

  await snapshotRepo.appendSnapshot({
    sessionId: newSessionId,
    summaryText: snapshotToCopy.summaryText,
    coveredUpToMessageId: newAnchorId,
    tailStartMessageId: newTailStartId,
    messageCount: snapshotToCopy.messageCount,
    tokenCount: snapshotToCopy.tokenCount
  })

  return true
}
