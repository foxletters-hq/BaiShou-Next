export type InvalidationListener = () => void

export interface InvalidationEpochStore {
  subscribe(listener: InvalidationListener): () => void
  getVersion(): number
  invalidate(_reason?: string): void
  clear(_reason?: string): void
}

/** 轻量失效计数器：用于 diary.list 等「仅需触发 refetch」的缓存键 */
export function createInvalidationEpochStore(): InvalidationEpochStore {
  let generation = 0
  const listeners = new Set<InvalidationListener>()

  const notify = (): void => {
    listeners.forEach((listener) => listener())
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getVersion() {
      return generation
    },
    invalidate() {
      generation += 1
      notify()
    },
    clear() {
      generation += 1
      notify()
    }
  }
}
