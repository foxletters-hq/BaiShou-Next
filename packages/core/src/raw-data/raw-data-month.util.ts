import { formatLocalDate } from '@baishou/shared'

/** Local calendar month YYYY-MM from Unix ms instant. */
export function shardMonthFromInstant(ms: number): string {
  const d = new Date(ms)
  const day = formatLocalDate(d)
  return day.slice(0, 7)
}

export function isValidShardMonth(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value)
}
