import type { SessionRepository, SnapshotRepository } from '@baishou/database'
import { resolveAggregateSnapshots } from '@baishou/shared'

export async function ensureSessionSnapshotsRestored(
  sessionId: string,
  snapshotRepo: SnapshotRepository,
  sessionRepo: Pick<SessionRepository, 'getSessionAggregate'>
): Promise<Awaited<ReturnType<SnapshotRepository['getLatestSnapshot']>>> {
  const existing = await snapshotRepo.getLatestSnapshot(sessionId)
  if (existing) return existing

  const aggregate = await sessionRepo.getSessionAggregate(sessionId)
  if (!aggregate) return null
  const snapshots = resolveAggregateSnapshots(aggregate)
  if (snapshots.length === 0) return null

  await snapshotRepo.replaceSnapshotsForSession(sessionId, snapshots)
  return snapshotRepo.getLatestSnapshot(sessionId)
}
