const listeners = new Set<() => void>()

export type GraphOptimisticDeleteEvent =
  | {
      kind: 'node'
      id: string
      deletedEdgeIds?: string[]
      phase: 'optimistic' | 'committed' | 'rollback'
    }
  | {
      kind: 'edge'
      id: string
      phase: 'optimistic' | 'committed' | 'rollback'
    }

const optimisticDeleteListeners = new Set<(event: GraphOptimisticDeleteEvent) => void>()

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

export function notifyGraphOptimisticDelete(event: GraphOptimisticDeleteEvent): void {
  for (const listener of optimisticDeleteListeners) {
    listener(event)
  }
}

export function subscribeGraphOptimisticDelete(
  listener: (event: GraphOptimisticDeleteEvent) => void
): () => void {
  optimisticDeleteListeners.add(listener)
  return () => {
    optimisticDeleteListeners.delete(listener)
  }
}
