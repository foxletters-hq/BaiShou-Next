const listeners = new Set<() => void>()

function emitGraphDataChanged(): void {
  for (const listener of listeners) listener()
}

/** 人生关系图被清空或改写后，图谱页与待确认计数重新读库。 */
export function notifyGraphDataChanged(): void {
  emitGraphDataChanged()
}

export function subscribeGraphDataChanged(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
