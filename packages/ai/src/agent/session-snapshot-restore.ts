import type { SessionRepository, SnapshotRepository } from '@baishou/database'
import { resolveAggregateSnapshots } from '@baishou/shared'

export async function ensureSessionSnapshotsRestored(
  sessionId: string,
  snapshotRepo: SnapshotRepository,
  sessionRepo: Pick<SessionRepository, 'getSessionAggregate'>,
  options?: { restoreSynthesizedFromMarkers?: boolean }
): Promise<Awaited<ReturnType<SnapshotRepository['getLatestSnapshot']>>> {
  const existing = await snapshotRepo.getLatestSnapshot(sessionId)
  if (existing) return existing
  // 重发截断会删掉失效快照；此时不能从留下的 compaction 标记再合成写回
  if (options?.restoreSynthesizedFromMarkers === false) return null

  const aggregate = await sessionRepo.getSessionAggregate(sessionId)
  if (!aggregate) return null
  const snapshots = resolveAggregateSnapshots(aggregate)
  if (snapshots.length === 0) return null

  await snapshotRepo.replaceSnapshotsForSession(sessionId, snapshots)
  return snapshotRepo.getLatestSnapshot(sessionId)
}
