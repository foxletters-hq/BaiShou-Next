/**
 * Line-level LWW merge for Memory / Graph monthly JSONL shards.
 * Fold by id → union; winner = higher updatedAt; same timestamp → tombstone wins;
 * still tied → canonical JSON string compare.
 */

export interface JsonlMergeableRecord {
  id: string
  updatedAt: number
  deletedAt?: number | null
  [key: string]: unknown
}

export interface ParseJsonlTextResult<T extends JsonlMergeableRecord = JsonlMergeableRecord> {
  rows: T[]
  skippedIllegal: number
  clampedFuture: number
}

export interface MergeTextsResult {
  text: string
  skippedIllegal: number
  clampedFuture: number
}

/** Future timestamps beyond this skew are clamped to now (P5c clock safety). */
export const JSONL_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

/**
 * Clamp absurd future updatedAt; drop negative updatedAt.
 * Returns null when the row must be discarded.
 */
export function sanitizeRecordTimestamps<T extends JsonlMergeableRecord>(
  row: T,
  now: number = Date.now()
): { row: T; clampedFuture: boolean } | null {
  const updatedAt = row.updatedAt
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt) || updatedAt < 0) {
    return null
  }
  if (updatedAt > now + JSONL_FUTURE_SKEW_MS) {
    return { row: { ...row, updatedAt: now }, clampedFuture: true }
  }
  return { row, clampedFuture: false }
}

export function foldJsonlRecordsById<T extends JsonlMergeableRecord>(rows: T[]): T[] {
  const map = new Map<string, T>()
  for (const row of rows) {
    if (!row?.id) continue
    const prev = map.get(row.id)
    if (!prev || pickWinner(prev, row) === row) {
      map.set(row.id, row)
    }
  }
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Pick LWW winner between two same-id records.
 * Tombstone preferred when updatedAt equal.
 */
export function pickWinner<T extends JsonlMergeableRecord>(a: T, b: T): T {
  const au = a.updatedAt ?? 0
  const bu = b.updatedAt ?? 0
  if (bu !== au) return bu > au ? b : a
  const aTomb = a.deletedAt != null
  const bTomb = b.deletedAt != null
  if (aTomb !== bTomb) return bTomb ? b : a
  return stableStringify(b) >= stableStringify(a) ? b : a
}

/**
 * Merge two sides' JSONL line arrays (already parsed). Returns collapsed winners.
 */
export function mergeJsonlRecordSides<T extends JsonlMergeableRecord>(
  localRows: T[],
  remoteRows: T[]
): T[] {
  const localFolded = foldJsonlRecordsById(localRows)
  const remoteFolded = foldJsonlRecordsById(remoteRows)
  const byId = new Map<string, T>()
  for (const row of localFolded) byId.set(row.id, row)
  for (const row of remoteFolded) {
    const prev = byId.get(row.id)
    byId.set(row.id, prev ? pickWinner(prev, row) : row)
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
}

export function parseJsonlText<T extends JsonlMergeableRecord>(
  text: string,
  now: number = Date.now()
): ParseJsonlTextResult<T> {
  const rows: T[] = []
  let skippedIllegal = 0
  let clampedFuture = 0
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const obj = JSON.parse(trimmed) as T
      if (!obj || typeof obj.id !== 'string') {
        skippedIllegal += 1
        continue
      }
      const sanitized = sanitizeRecordTimestamps(obj, now)
      if (!sanitized) {
        skippedIllegal += 1
        continue
      }
      if (sanitized.clampedFuture) clampedFuture += 1
      rows.push(sanitized.row)
    } catch {
      skippedIllegal += 1
    }
  }
  return { rows, skippedIllegal, clampedFuture }
}

export function serializeJsonlRecords(rows: JsonlMergeableRecord[]): string {
  if (rows.length === 0) return ''
  return rows.map((r) => JSON.stringify(r)).join('\n') + '\n'
}

export class JsonlRecordMergeService {
  mergeTexts(localText: string, remoteText: string, now: number = Date.now()): MergeTextsResult {
    const local = parseJsonlText(localText, now)
    const remote = parseJsonlText(remoteText, now)
    const merged = mergeJsonlRecordSides(local.rows, remote.rows)
    return {
      text: serializeJsonlRecords(merged),
      skippedIllegal: local.skippedIllegal + remote.skippedIllegal,
      clampedFuture: local.clampedFuture + remote.clampedFuture
    }
  }
}
