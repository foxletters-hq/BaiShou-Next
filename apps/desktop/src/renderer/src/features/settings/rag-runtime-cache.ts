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

function emit() {
  for (const listener of listeners) {
    listener()
  }
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
  cachedStats = stats
  emit()
}

export function patchCachedRagStats(patch: Partial<RagRuntimeStats>): void {
  cachedStats = { ...cachedStats, ...patch }
  emit()
}

export function setCachedRagActiveState(state: RagRuntimeActiveState): void {
  cachedActiveState = state
  emit()
}

export function patchCachedRagActiveState(patch: Partial<RagRuntimeActiveState>): void {
  cachedActiveState = { ...cachedActiveState, ...patch }
  emit()
}

export function subscribeRagRuntime(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
