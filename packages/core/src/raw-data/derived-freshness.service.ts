import { resolveDiaryExtractBits } from './diary-extract-bits'
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
  listJournals: () => Promise<Array<{ filePath: string; contentHash: string; date?: string }>>
  /** Persist extract-state cursor after successful LLM extract */
  writeExtractState: (filePath: string, contentHash: string) => Promise<void>
}

const JOURNAL_DATE_IN_PATH = /(?:^|\/)(\d{4}-\d{2}-\d{2})\.md$/i

function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\/+/, '')
}

function extractJournalDateFromPath(filePath: string): string | null {
  const m = JOURNAL_DATE_IN_PATH.exec(normalizeFilePath(filePath))
  return m?.[1] ?? null
}

function lookupExtractedHash(
  extractHashes: Map<string, string>,
  filePath: string,
  date?: string
): string | null {
  const key = normalizeFilePath(filePath)
  const direct = extractHashes.get(key)
  if (direct !== undefined) return direct
  const resolvedDate =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : extractJournalDateFromPath(key)
  if (!resolvedDate) return null
  const byDate = extractHashes.get(`date:${resolvedDate}`)
  if (byDate !== undefined) return byDate
  const canonical = `Journals/${resolvedDate.slice(0, 4)}/${resolvedDate.slice(5, 7)}/${resolvedDate}.md`
  const byCanonical = extractHashes.get(canonical)
  if (byCanonical !== undefined) return byCanonical
  return extractHashes.get(`Journals/${resolvedDate}.md`) ?? null
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

  async listPendingIndex(kind: FreshnessKind, collection?: string): Promise<ShardInfo[]> {
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

  clearReextractMarks(): void {
    this.reextractMarks.clear()
  }

  /**
   * Diaries that exist and whose body hash ≠ extract-state cursor (or never extracted).
   * Edited-but-unchanged body stays extracted. Missing graph rows do not enqueue.
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
      if (!key) continue
      const last = lookupExtractedHash(extractHashes, key, j.date)
      const bits = resolveDiaryExtractBits({
        contentHash: j.contentHash,
        extractedHash: last
      })
      if (!bits.exists || !bits.needsReextract) continue
      byPath.set(key, {
        filePath: key,
        contentHash: j.contentHash,
        lastExtractedHash: last,
        date: j.date
      })
    }

    const marks = [...this.reextractMarks.entries()]
    const stale: string[] = []
    for (const [filePath, contentHash] of marks) {
      const key = normalizeFilePath(filePath)
      const existing = byPath.get(key)
      const last = lookupExtractedHash(extractHashes, key, existing?.date)
      const bits = resolveDiaryExtractBits({ contentHash, extractedHash: last })
      if (!bits.needsReextract) {
        stale.push(key)
        continue
      }
      byPath.set(key, {
        filePath: key,
        contentHash,
        lastExtractedHash: last,
        date: existing?.date
      })
    }
    for (const key of stale) this.reextractMarks.delete(key)

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
    const dateKey = extractJournalDateFromPath(key)
    if (dateKey) {
      for (const markKey of [...this.reextractMarks.keys()]) {
        if (extractJournalDateFromPath(markKey) === dateKey) {
          this.reextractMarks.delete(markKey)
        }
      }
    }
  }
}
