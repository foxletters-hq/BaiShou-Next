const listeners = new Set<() => void>()
let pendingFocusRequested = false

function emitPendingFocus(): void {
  for (const listener of listeners) listener()
}

/** 记忆页「去检查」：打开图谱待确认页签 */
export function requestGraphPendingFocus(): void {
  pendingFocusRequested = true
  emitPendingFocus()
}

export function consumeGraphPendingFocus(): boolean {
  if (!pendingFocusRequested) return false
  pendingFocusRequested = false
  return true
}

export function subscribeGraphPendingFocus(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
