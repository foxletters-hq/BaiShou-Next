export interface PendingEmbedCounts {
  diaries: number
  memories: number
  graphNodes: number
  knowledgeSources: number
  /** 笔记本图节点向量，与资料分块向量分开计。 */
  notebookGraphNodes: number
  total: number
}

export const EMPTY_PENDING_EMBED_COUNTS: PendingEmbedCounts = {
  diaries: 0,
  memories: 0,
  graphNodes: 0,
  knowledgeSources: 0,
  notebookGraphNodes: 0,
  total: 0
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
  missingKnowledgeSourceCount?: number
  missingNotebookGraphNodeCount?: number
}): PendingEmbedCounts {
  const diaries = nonNegativeCount(input.unindexedDiaryCount)
  const memories = nonNegativeCount(input.missingMemoryCount)
  const graphNodes = nonNegativeCount(input.missingGraphNodeCount)
  const knowledgeSources = nonNegativeCount(input.missingKnowledgeSourceCount ?? 0)
  const notebookGraphNodes = nonNegativeCount(input.missingNotebookGraphNodeCount ?? 0)
  return {
    diaries,
    memories,
    graphNodes,
    knowledgeSources,
    notebookGraphNodes,
    total: diaries + memories + graphNodes + knowledgeSources + notebookGraphNodes
  }
}

/** listUnembeddedLiveNodes 的计数口径：空列表或抛错都记 0，不把资料计数混进来。 */
export async function countPendingFromUnembeddedList(
  listUnembeddedLiveNodes: () => Promise<ReadonlyArray<unknown> | null | undefined>
): Promise<number> {
  try {
    const rows = await listUnembeddedLiveNodes()
    if (!Array.isArray(rows)) return 0
    return rows.length
  } catch {
    return 0
  }
}

export function createPendingEmbedCountCache() {
  let cached: PendingEmbedCounts | null = null
  let inflight: Promise<PendingEmbedCounts> | null = null

  return {
    invalidate(): void {
      cached = null
    },
    async get(loader: () => Promise<PendingEmbedCounts>): Promise<PendingEmbedCounts> {
      if (cached) return cached
      if (inflight) return inflight
      inflight = loader()
        .then((value) => {
          cached = value
          return value
        })
        .finally(() => {
          inflight = null
        })
      return inflight
    }
  }
}
