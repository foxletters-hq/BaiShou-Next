import {
  EMPTY_PENDING_EMBED_COUNTS,
  firstActivePhase,
  MEMORY_ORGANIZE_PHASE_IDS,
  overallFromPhaseCounts,
  pendingOrganizeArticleCount,
  phaseCountForId,
  phaseCountsFromPending,
  resolvePhaseRowStatus,
  type PendingEmbedCounts,
  type RagBatchEmbedPhaseCounts,
  type RagBatchEmbedPhaseId,
  type RagBatchEmbedPhaseKind,
  type RagBatchEmbedPhaseStatus
} from '@baishou/shared'

export function snapshotMemoryEmbedPhases(
  counts: PendingEmbedCounts & { graphExtract?: number; graphDisambiguate?: number },
  graphExtract = 0
): {
  phase: RagBatchEmbedPhaseKind
  phases: RagBatchEmbedPhaseCounts
  total: number
} {
  const input = {
    ...counts,
    graphExtract: counts.graphExtract ?? graphExtract,
    graphDisambiguate: counts.graphDisambiguate ?? 0
  }
  const phases = phaseCountsFromPending(input)
  return {
    phase: firstActivePhase(input),
    phases,
    total: overallFromPhaseCounts(phases).total
  }
}

export async function loadMemoryOrganizePending(ragService: {
  getOrganizePendingSnapshot?: () => Promise<
    PendingEmbedCounts & { graphExtract: number; graphDisambiguate: number }
  >
  getPendingEmbedCounts?: () => Promise<PendingEmbedCounts>
}): Promise<PendingEmbedCounts & { graphExtract?: number; graphDisambiguate?: number }> {
  try {
    if (ragService.getOrganizePendingSnapshot) {
      return await ragService.getOrganizePendingSnapshot()
    }
  } catch {
    // 整理快照失败时退回嵌入计数
  }
  try {
    return (await ragService.getPendingEmbedCounts?.()) ?? EMPTY_PENDING_EMBED_COUNTS
  } catch {
    return EMPTY_PENDING_EMBED_COUNTS
  }
}

export function memoryOrganizeProgressPercent(progress: number, total: number): number {
  if (!Number.isFinite(progress) || !Number.isFinite(total) || total <= 0) return 0
  return Math.min(100, Math.max(0, (progress / total) * 100))
}

export function isMemoryOrganizeIdle(input: {
  pendingEmbedCount: number
  pendingGraphCount: number
}): boolean {
  return input.pendingEmbedCount <= 0 && input.pendingGraphCount <= 0
}

/** 右下角整理按钮上的「篇」：待抽图日记，或尚未嵌入的日记；节点向量不算篇。 */
export function memoryOrganizePendingArticleCount(input: {
  pendingEmbedCount: number
  pendingGraphCount: number
  pendingDiaryCount?: number
}): number {
  return pendingOrganizeArticleCount(input)
}

export type MemoryOrganizeFabKind = 'loading' | 'idle' | 'pending'

/** 缓存快照只用来立刻显示待整理篇数；空快照仍走 loading，避免先进「已整理完毕」。 */
export function immediateOrganizePendingSnapshot<
  T extends { total: number; graphExtract: number; diaries?: number }
>(snapshot: T | null): T | null {
  if (!snapshot) return null
  if (
    memoryOrganizePendingArticleCount({
      pendingEmbedCount: snapshot.total,
      pendingGraphCount: snapshot.graphExtract,
      pendingDiaryCount: snapshot.diaries
    }) <= 0
  ) {
    return null
  }
  return snapshot
}

/** 待办快照未就绪时不显示「已整理完毕」，避免进页先空后跳。 */
export function resolveMemoryOrganizeFabState(input: {
  snapshotReady: boolean
  pendingEmbedCount: number
  pendingGraphCount: number
  pendingDiaryCount?: number
}): { kind: MemoryOrganizeFabKind; pendingCount: number } {
  if (!input.snapshotReady) return { kind: 'loading', pendingCount: 0 }
  const pendingCount = memoryOrganizePendingArticleCount(input)
  if (pendingCount <= 0) return { kind: 'idle', pendingCount: 0 }
  return { kind: 'pending', pendingCount }
}

/** 仅在整理到一半被打断且仍有待整理篇数时，才显示「整理未完成」卡片；平时仅右下角按钮提示待整理。 */
export function memoryOrganizeCardKind(input: {
  running: boolean
  pendingCount: number
  interrupted?: boolean
}): 'hidden' | 'running' | 'incomplete' {
  if (input.running) return 'running'
  if (input.interrupted && input.pendingCount > 0) return 'incomplete'
  return 'hidden'
}

export function isMemoryOrganizeCancelledError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'MobileRagAbortError'
  )
}

export type MemoryOrganizePhaseRow = {
  id: RagBatchEmbedPhaseId
  status: RagBatchEmbedPhaseStatus
  completed: number
  total: number
  barPercent: number
}

export function memoryOrganizePhaseRows(input: {
  phase?: RagBatchEmbedPhaseKind
  phases?: RagBatchEmbedPhaseCounts
}): MemoryOrganizePhaseRow[] {
  if (!input.phases) return []
  return MEMORY_ORGANIZE_PHASE_IDS.map((id) => {
    const item = phaseCountForId(input.phases!, id)
    const status = resolvePhaseRowStatus(id, input.phase, item, input.phases)
    return {
      id,
      status,
      completed: item.completed,
      total: item.total,
      barPercent:
        status === 'done'
          ? 100
          : status === 'running'
            ? memoryOrganizeProgressPercent(item.completed, item.total)
            : 0
    }
  })
}
