import type { RagState } from '@baishou/ui/native'

const DEFAULT_ACTIVE_STATE: RagState = {
  isRunning: false,
  type: 'idle',
  progress: 0,
  total: 0,
  statusText: ''
}

let cachedActiveState: RagState = { ...DEFAULT_ACTIVE_STATE }
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function getCachedMobileRagState(): RagState {
  return cachedActiveState
}

export function setCachedMobileRagState(state: RagState): void {
  cachedActiveState = state
  emit()
}

export function patchCachedMobileRagState(patch: Partial<RagState>): void {
  cachedActiveState = { ...cachedActiveState, ...patch }
  emit()
}

export function resetCachedMobileRagActiveState(): void {
  cachedActiveState = { ...DEFAULT_ACTIVE_STATE }
  emit()
}

export function subscribeMobileRagRuntime(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** @internal 仅供单元测试重置模块级缓存 */
export function resetMobileRagRuntimeCacheForTests(): void {
  cachedActiveState = { ...DEFAULT_ACTIVE_STATE }
  listeners.clear()
}
