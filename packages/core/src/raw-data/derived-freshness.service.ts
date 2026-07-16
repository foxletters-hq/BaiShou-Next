import type { MonthlyJsonlStore } from './stores/monthly-jsonl.store'
import type { RawSourceKind, ShardInfo } from './raw-data-source.types'

export type FreshnessKind = Extract<RawSourceKind, 'memory' | 'graph'>

/**
 * Tracks which monthly JSONL shards need derived-index sync (pending-index).
 * pending-reextract (diary → graph) is reserved for P2.
 */
export class DerivedFreshnessService {
  private readonly stores = new Map<string, MonthlyJsonlStore>()

  registerStore(key: string, store: MonthlyJsonlStore): void {
    this.stores.set(key, store)
  }

  private storeKey(kind: FreshnessKind, collection?: string): string {
    return collection ? `${kind}:${collection}` : kind
  }

  async listPendingIndex(
    kind: FreshnessKind,
    collection?: string
  ): Promise<ShardInfo[]> {
    const store = this.stores.get(this.storeKey(kind, collection))
    if (!store) return []
    return store.listPendingIndex()
  }

  async commitIndexed(
    kind: FreshnessKind,
    relativePath: string,
    contentHash: string,
    collection?: string
  ): Promise<void> {
    const store = this.stores.get(this.storeKey(kind, collection))
    if (!store) return
    await store.markIndexed(relativePath, contentHash)
  }
}
