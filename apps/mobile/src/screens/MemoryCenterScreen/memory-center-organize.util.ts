import {
  EMPTY_PENDING_EMBED_COUNTS,
  firstActivePhase,
  overallFromPhaseCounts,
  phaseCountsFromPending,
  type PendingEmbedCounts,
  type RagBatchEmbedPhaseCounts,
  type RagBatchEmbedPhaseKind
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
