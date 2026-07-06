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
let emitRafId: number | null = null

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
  if (emitRafId != null) return
  emitRafId = window.requestAnimationFrame(() => {
    emitRafId = null
    emit()
  })
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
  scheduleEmit()
}

export function setCachedRagActiveState(state: RagRuntimeActiveState): void {
  cachedActiveState = state
  emit()
}

export function patchCachedRagActiveState(patch: Partial<RagRuntimeActiveState>): void {
  cachedActiveState = { ...cachedActiveState, ...patch }
  scheduleEmit()
}

export function subscribeRagRuntime(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
