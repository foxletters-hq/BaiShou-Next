import type { MonthlyJsonlStore } from './stores/monthly-jsonl.store'
import type { RawSourceKind, ShardInfo } from './raw-data-source.types'

export type FreshnessKind = Extract<RawSourceKind, 'memory' | 'graph'>

export interface PendingReextractRef {
  filePath: string
  contentHash: string
  lastExtractedHash: string | null
  date?: string
}

export interface PendingReextractCollaborators {
  /** filePath → latest sourceContentHash from extract-state (live rows only) */
  loadExtractHashes: () => Promise<Map<string, string>>
  /** Current journal rows from shadow index (or equivalent) */
  listJournals: () => Promise<
    Array<{ filePath: string; contentHash: string; date?: string }>
  >
  /** Persist extract-state cursor after successful LLM extract */
  writeExtractState: (filePath: string, contentHash: string) => Promise<void>
}

function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\/+/, '')
}

/**
 * Tracks pending-index (JSONL → SQLite) and pending-reextract (diary → graph LLM).
 */
export class DerivedFreshnessService {
  private readonly stores = new Map<string, MonthlyJsonlStore>()
  /** Explicit dirty marks from journal isChanged (merged into listPendingReextract). */
  private readonly reextractMarks = new Map<string, string>()
  private collaborators: PendingReextractCollaborators | null = null

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

  /** Wire extract-state + shadow journal listing (call after GraphRawManager / shadow ready). */
  bindPendingReextract(collaborators: PendingReextractCollaborators): void {
    this.collaborators = collaborators
  }

  markPendingReextract(filePath: string, contentHash: string): void {
    const key = normalizeFilePath(filePath)
    if (!key || !contentHash) return
    this.reextractMarks.set(key, contentHash)
  }

  /**
   * Diaries whose current contentHash ≠ extract-state cursor (or never extracted).
   * Merges explicit marks with a full shadow scan when collaborators are bound.
   */
  async listPendingReextract(): Promise<PendingReextractRef[]> {
    const extractHashes =
      (await this.collaborators?.loadExtractHashes()) ?? new Map<string, string>()
    const byPath = new Map<string, PendingReextractRef>()

    const journals: Array<{ filePath: string; contentHash: string; date?: string }> =
      (await this.collaborators?.listJournals()) ??
      [...this.reextractMarks.entries()].map(([filePath, contentHash]) => ({
        filePath,
        contentHash
      }))

    for (const j of journals) {
      const key = normalizeFilePath(j.filePath)
      if (!key || !j.contentHash) continue
      const last = extractHashes.get(key) ?? null
      if (last === j.contentHash) continue
      byPath.set(key, {
        filePath: key,
        contentHash: j.contentHash,
        lastExtractedHash: last,
        date: j.date
      })
    }

    for (const [filePath, contentHash] of this.reextractMarks) {
      const key = normalizeFilePath(filePath)
      const last = extractHashes.get(key) ?? null
      if (last === contentHash) {
        this.reextractMarks.delete(key)
        continue
      }
      const existing = byPath.get(key)
      byPath.set(key, {
        filePath: key,
        contentHash,
        lastExtractedHash: last,
        date: existing?.date
      })
    }

    return [...byPath.values()].sort((a, b) =>
      (b.date || b.filePath).localeCompare(a.date || a.filePath)
    )
  }

  async commitReextract(filePath: string, contentHash: string): Promise<void> {
    const key = normalizeFilePath(filePath)
    if (!this.collaborators) {
      throw new Error('DerivedFreshnessService: pending-reextract collaborators not bound')
    }
    await this.collaborators.writeExtractState(key, contentHash)
    this.reextractMarks.delete(key)
  }
}
