import {
  firstActivePhase,
  overallFromPhaseCounts,
  phaseCountsFromPending,
  type PendingEmbedCounts,
  type RagBatchEmbedPhaseCounts,
  type RagBatchEmbedPhaseKind
} from '@baishou/shared'

export function snapshotMemoryEmbedPhases(
  counts: PendingEmbedCounts,
  graphExtract = 0
): {
  phase: RagBatchEmbedPhaseKind
  phases: RagBatchEmbedPhaseCounts
  total: number
} {
  const input = { ...counts, graphExtract }
  const phases = phaseCountsFromPending(input)
  return {
    phase: firstActivePhase(input),
    phases,
    total: overallFromPhaseCounts(phases).total
  }
}
