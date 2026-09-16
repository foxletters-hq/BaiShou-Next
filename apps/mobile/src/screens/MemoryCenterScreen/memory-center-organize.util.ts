import {
  firstActivePhase,
  overallFromPhaseCounts,
  phaseCountsFromPending,
  type PendingEmbedCounts,
  type RagBatchEmbedPhaseCounts,
  type RagBatchEmbedPhaseKind
} from '@baishou/shared'

export function snapshotMemoryEmbedPhases(counts: PendingEmbedCounts): {
  phase: RagBatchEmbedPhaseKind
  phases: RagBatchEmbedPhaseCounts
  total: number
} {
  const phases = phaseCountsFromPending(counts)
  return {
    phase: firstActivePhase(counts),
    phases,
    total: overallFromPhaseCounts(phases).total
  }
}
