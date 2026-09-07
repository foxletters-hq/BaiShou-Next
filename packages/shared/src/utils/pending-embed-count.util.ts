export interface PendingEmbedCounts {
  diaries: number
  memories: number
  graphNodes: number
  total: number
}

/** 与 memory-readiness.util 的 nonNegativeCount 同一口径：非有限值归零，负数归零，小数向下取整。 */
function nonNegativeCount(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

export function buildPendingEmbedCounts(input: {
  unindexedDiaryCount: number
  missingMemoryCount: number
  missingGraphNodeCount: number
}): PendingEmbedCounts {
  const diaries = nonNegativeCount(input.unindexedDiaryCount)
  const memories = nonNegativeCount(input.missingMemoryCount)
  const graphNodes = nonNegativeCount(input.missingGraphNodeCount)
  return {
    diaries,
    memories,
    graphNodes,
    total: diaries + memories + graphNodes
  }
}
