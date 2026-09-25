const listeners = new Set<() => void>()
let graphTabRequested = false

function emitGraphTab(): void {
  for (const listener of listeners) listener()
}

/** 向量页「去检查」：切到记忆中心的关系图谱页签 */
export function requestMemoryGraphTab(): void {
  graphTabRequested = true
  emitGraphTab()
}

export function consumeMemoryGraphTab(): boolean {
  if (!graphTabRequested) return false
  graphTabRequested = false
  return true
}

export function subscribeMemoryGraphTab(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
