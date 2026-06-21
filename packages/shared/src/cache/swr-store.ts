export type SwrListener = () => void

export interface StaleWhileRevalidateStore<T> {
  subscribe(listener: SwrListener): () => void
  peek(scopeKey: string): { value: T; stale: boolean } | null
  commit(scopeKey: string, value: T): void
  invalidate(_reason?: string): void
  clear(): void
  getVersion(): number
}

/** 通用 SWR 快照：保留旧值展示，generation 不对齐时标记 stale */
export function createStaleWhileRevalidateStore<T>(): StaleWhileRevalidateStore<T> {
  let snapshot: T | null = null
  let snapshotScopeKey: string | null = null
  let invalidationGeneration = 0
  let committedGeneration = -1
  const listeners = new Set<SwrListener>()

  const notify = (): void => {
    listeners.forEach((listener) => listener())
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    peek(scopeKey) {
      if (snapshot === null || snapshotScopeKey !== scopeKey) return null
      return {
        value: snapshot,
        stale: committedGeneration !== invalidationGeneration
      }
    },
    commit(scopeKey, value) {
      snapshot = value
      snapshotScopeKey = scopeKey
      committedGeneration = invalidationGeneration
      notify()
    },
    invalidate() {
      invalidationGeneration += 1
      notify()
    },
    clear() {
      snapshot = null
      snapshotScopeKey = null
      committedGeneration = -1
      invalidationGeneration += 1
      notify()
    },
    getVersion() {
      return invalidationGeneration
    }
  }
}
