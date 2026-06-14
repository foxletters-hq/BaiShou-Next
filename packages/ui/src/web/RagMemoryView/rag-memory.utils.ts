import { formatRagEntryTimestamp } from '@baishou/shared'
import type { RagEntry } from './rag-memory.types'

export const ensureMillis = (ts: unknown): number => {
  if (!ts) return Date.now()
  let num = typeof ts === 'number' ? ts : new Date(ts as string).getTime()
  if (isNaN(num)) return Date.now()
  while (num > 1e14) {
    num = Math.floor(num / 1000)
  }
  while (num < 1e11 && num > 0) {
    num = num * 1000
  }
  return num
}

export const formatRagDate = (ms: number): string => {
  const d = new Date(ensureMillis(ms))
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const formatRagEntryDate = (entry: RagEntry): string =>
  formatRagEntryTimestamp(entry.createdAt, entry.sourceType)
