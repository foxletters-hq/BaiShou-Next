import type { RagBatchEmbedPhaseCounts, RagBatchEmbedPhaseKind } from '@baishou/shared'

export interface RagRuntimeStats {
  totalCount: number
  currentDimension: number
  totalSizeText: string
}

export interface RagRuntimeActiveState {
  isRunning: boolean
  type: 'idle' | 'batchEmbed' | 'migration'
  progress: number
  total: number
  statusText: string
  statusKey?: string
  error?: string
  aborted?: boolean
  rollbackApplied?: boolean
  phase?: RagBatchEmbedPhaseKind
  phases?: RagBatchEmbedPhaseCounts
  paused?: boolean
  cancelling?: boolean
}

const DEFAULT_STATS: RagRuntimeStats = {
  totalCount: 0,
  currentDimension: 0,
  totalSizeText: '0 KB'
}

const DEFAULT_ACTIVE_STATE: RagRuntimeActiveState = {
  isRunning: false,
  type: 'idle',
  progress: 0,
  total: 0,
  statusText: ''
}

type RagRuntimeSnapshot = {
  stats: RagRuntimeStats
  activeRagState: RagRuntimeActiveState
}

let cachedStats: RagRuntimeStats = { ...DEFAULT_STATS }
let cachedActiveState: RagRuntimeActiveState = { ...DEFAULT_ACTIVE_STATE }
const listeners = new Set<() => void>()
let emitTimerId: ReturnType<typeof setTimeout> | null = null

function isSamePhaseItem(
  a?: { completed: number; total: number; done?: boolean },
  b?: { completed: number; total: number; done?: boolean }
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.completed === b.completed && a.total === b.total && Boolean(a.done) === Boolean(b.done)
}

function isSamePhases(a?: RagBatchEmbedPhaseCounts, b?: RagBatchEmbedPhaseCounts): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    isSamePhaseItem(a.diaries, b.diaries) &&
    isSamePhaseItem(a.memories, b.memories) &&
    isSamePhaseItem(a.graphNodes, b.graphNodes) &&
    isSamePhaseItem(a.knowledgeSources, b.knowledgeSources) &&
    isSamePhaseItem(a.graphExtract, b.graphExtract) &&
    isSamePhaseItem(a.graphDisambiguate, b.graphDisambiguate)
  )
}

function isSameRagStats(a: RagRuntimeStats, b: RagRuntimeStats): boolean {
  return (
    a === b ||
    (a.totalCount === b.totalCount &&
      a.currentDimension === b.currentDimension &&
      a.totalSizeText === b.totalSizeText)
  )
}

function isSameRagActiveState(a: RagRuntimeActiveState, b: RagRuntimeActiveState): boolean {
  return (
    a === b ||
    (a.isRunning === b.isRunning &&
      a.type === b.type &&
      a.progress === b.progress &&
      a.total === b.total &&
      a.statusText === b.statusText &&
      a.statusKey === b.statusKey &&
      a.error === b.error &&
      Boolean(a.aborted) === Boolean(b.aborted) &&
      Boolean(a.rollbackApplied) === Boolean(b.rollbackApplied) &&
      a.phase === b.phase &&
      isSamePhases(a.phases, b.phases) &&
      Boolean(a.paused) === Boolean(b.paused) &&
      Boolean(a.cancelling) === Boolean(b.cancelling))
  )
}

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

function scheduleEmit(): void {
  if (typeof window === 'undefined') {
    emit()
    return
  }
  if (emitTimerId != null) return
  emitTimerId = setTimeout(() => {
    emitTimerId = null
    emit()
  }, 16)
}

export function getRagRuntimeSnapshot(): RagRuntimeSnapshot {
  return { stats: cachedStats, activeRagState: cachedActiveState }
}

export function getCachedRagStats(): RagRuntimeStats {
  return cachedStats
}

export function getCachedRagActiveState(): RagRuntimeActiveState {
  return cachedActiveState
}

export function setCachedRagStats(stats: RagRuntimeStats): void {
  if (isSameRagStats(cachedStats, stats)) return
  cachedStats = stats
  scheduleEmit()
}

export function patchCachedRagStats(patch: Partial<RagRuntimeStats>): void {
  const next = { ...cachedStats, ...patch }
  if (isSameRagStats(cachedStats, next)) return
  cachedStats = next
  scheduleEmit()
}

export function setCachedRagActiveState(state: RagRuntimeActiveState): void {
  if (isSameRagActiveState(cachedActiveState, state)) return
  cachedActiveState = state
  scheduleEmit()
}

export function patchCachedRagActiveState(patch: Partial<RagRuntimeActiveState>): void {
  const next = { ...cachedActiveState, ...patch }
  if (isSameRagActiveState(cachedActiveState, next)) return
  cachedActiveState = next
  scheduleEmit()
}

export function subscribeRagRuntime(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
