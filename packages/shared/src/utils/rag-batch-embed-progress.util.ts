import type { PendingEmbedCounts } from './pending-embed-count.util'

export const RAG_BATCH_EMBED_PHASE_IDS = ['diary', 'memory', 'graph_node', 'knowledge'] as const

export type RagBatchEmbedPhaseId = (typeof RAG_BATCH_EMBED_PHASE_IDS)[number]

export type RagBatchEmbedPhaseKind = RagBatchEmbedPhaseId | 'starting' | 'finishing'

export type RagBatchEmbedPhaseStatus = 'pending' | 'running' | 'done' | 'skipped'

export type RagBatchEmbedPhaseCount = {
  completed: number
  total: number
}

export type RagBatchEmbedPhaseCounts = {
  diaries: RagBatchEmbedPhaseCount
  memories: RagBatchEmbedPhaseCount
  graphNodes: RagBatchEmbedPhaseCount
  knowledgeSources: RagBatchEmbedPhaseCount
}

export const EMPTY_RAG_BATCH_EMBED_PHASES: RagBatchEmbedPhaseCounts = {
  diaries: { completed: 0, total: 0 },
  memories: { completed: 0, total: 0 },
  graphNodes: { completed: 0, total: 0 },
  knowledgeSources: { completed: 0, total: 0 }
}

const PHASE_COUNT_KEY: Record<RagBatchEmbedPhaseId, keyof RagBatchEmbedPhaseCounts> = {
  diary: 'diaries',
  memory: 'memories',
  graph_node: 'graphNodes',
  knowledge: 'knowledgeSources'
}

function clampCount(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

export function createPhaseCount(completed: number, total: number): RagBatchEmbedPhaseCount {
  const safeTotal = clampCount(total)
  return {
    completed: Math.min(clampCount(completed), safeTotal),
    total: safeTotal
  }
}

export function phaseCountsFromPending(
  counts: Pick<PendingEmbedCounts, 'diaries' | 'memories' | 'graphNodes' | 'knowledgeSources'>
): RagBatchEmbedPhaseCounts {
  return {
    diaries: createPhaseCount(0, counts.diaries),
    memories: createPhaseCount(0, counts.memories),
    graphNodes: createPhaseCount(0, counts.graphNodes),
    knowledgeSources: createPhaseCount(0, counts.knowledgeSources)
  }
}

export function patchPhaseCounts(
  phases: RagBatchEmbedPhaseCounts,
  id: RagBatchEmbedPhaseId,
  patch: Partial<RagBatchEmbedPhaseCount>
): RagBatchEmbedPhaseCounts {
  const key = PHASE_COUNT_KEY[id]
  const current = phases[key]
  return {
    ...phases,
    [key]: createPhaseCount(patch.completed ?? current.completed, patch.total ?? current.total)
  }
}

/**
 * 按计划总数更新进度。已完成数上涨时不得抬高总数，避免界面出现 1/1、2/2、80/80。
 */
export function applyFrozenPhaseProgress(
  phases: RagBatchEmbedPhaseCounts,
  id: RagBatchEmbedPhaseId,
  progress: { completed: number; total: number }
): RagBatchEmbedPhaseCounts {
  const key = PHASE_COUNT_KEY[id]
  const plannedTotal = Math.max(phases[key].total, clampCount(progress.total))
  return patchPhaseCounts(phases, id, {
    completed: progress.completed,
    total: plannedTotal
  })
}

export function markPhaseDone(
  phases: RagBatchEmbedPhaseCounts,
  id: RagBatchEmbedPhaseId
): RagBatchEmbedPhaseCounts {
  const key = PHASE_COUNT_KEY[id]
  const total = phases[key].total
  return patchPhaseCounts(phases, id, { completed: total, total })
}

export function overallFromPhaseCounts(phases: RagBatchEmbedPhaseCounts): {
  completed: number
  total: number
} {
  const total =
    phases.diaries.total +
    phases.memories.total +
    phases.graphNodes.total +
    phases.knowledgeSources.total
  const completed =
    phases.diaries.completed +
    phases.memories.completed +
    phases.graphNodes.completed +
    phases.knowledgeSources.completed
  return { completed, total: Math.max(total, 1) }
}

export function firstActivePhase(
  counts: Pick<PendingEmbedCounts, 'diaries' | 'memories' | 'graphNodes' | 'knowledgeSources'>
): RagBatchEmbedPhaseKind {
  if (counts.diaries > 0) return 'diary'
  if (counts.memories > 0) return 'memory'
  if (counts.graphNodes > 0) return 'graph_node'
  if (counts.knowledgeSources > 0) return 'knowledge'
  return 'finishing'
}

export function ragBatchEmbedPhaseLabelKey(id: RagBatchEmbedPhaseId): string {
  switch (id) {
    case 'diary':
      return 'settings.rag_phase_diary'
    case 'memory':
      return 'settings.rag_phase_memory'
    case 'graph_node':
      return 'settings.rag_phase_graph'
    case 'knowledge':
      return 'settings.rag_phase_knowledge'
  }
}

export function phaseCountForId(
  phases: RagBatchEmbedPhaseCounts,
  id: RagBatchEmbedPhaseId
): RagBatchEmbedPhaseCount {
  return phases[PHASE_COUNT_KEY[id]]
}

export function currentPhaseProgress(
  phase: RagBatchEmbedPhaseKind | undefined,
  phases: RagBatchEmbedPhaseCounts | undefined
): { id: RagBatchEmbedPhaseId; completed: number; total: number } | null {
  if (!phase || !phases) return null
  if (phase === 'starting' || phase === 'finishing') return null
  const item = phaseCountForId(phases, phase)
  return { id: phase, completed: item.completed, total: item.total }
}

const PHASE_ORDER: RagBatchEmbedPhaseId[] = [...RAG_BATCH_EMBED_PHASE_IDS]

export function resolvePhaseRowStatus(
  id: RagBatchEmbedPhaseId,
  current: RagBatchEmbedPhaseKind | undefined,
  item: RagBatchEmbedPhaseCount
): RagBatchEmbedPhaseStatus {
  if (item.total <= 0) return 'skipped'
  if (current === id) return 'running'
  if (current === 'starting') return 'pending'
  if (current === 'finishing') return 'done'
  const currentIndex = PHASE_ORDER.indexOf(current as RagBatchEmbedPhaseId)
  const rowIndex = PHASE_ORDER.indexOf(id)
  if (currentIndex >= 0 && rowIndex < currentIndex) return 'done'
  return 'pending'
}
