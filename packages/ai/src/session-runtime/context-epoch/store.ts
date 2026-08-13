import type { ContextEpochStore, ContextEpochState } from './types'

/** 进程内 Context Epoch 持久化（桌面可再包一层磁盘） */
export class MemoryContextEpochStore implements ContextEpochStore {
  private readonly map = new Map<string, ContextEpochState>()

  load(sessionId: string): ContextEpochState | null {
    return this.map.get(sessionId) ?? null
  }

  save(state: ContextEpochState): void {
    this.map.set(state.sessionId, state)
  }

  delete(sessionId: string): void {
    this.map.delete(sessionId)
  }

  clear(): void {
    this.map.clear()
  }
}

let defaultStore: ContextEpochStore = new MemoryContextEpochStore()

export function getContextEpochStore(): ContextEpochStore {
  return defaultStore
}

export function setContextEpochStore(store: ContextEpochStore): void {
  defaultStore = store
}

export function resetContextEpochStoreForTests(): void {
  defaultStore = new MemoryContextEpochStore()
}
