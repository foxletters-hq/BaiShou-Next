/** Diary date → graph edge validFrom / shardMonth (never use Date.now() for diary edges). */

const DATE_RE = /(\d{4})[-/](\d{2})[-/](\d{2})/
const MONTH_RE = /^(\d{4})-(\d{2})$/

export type GraphDiaryInstant = {
  /** Local midnight of the diary date, or null if unknown. */
  validFrom: number | null
  /** YYYY-MM for JSONL shard / SQL filter. */
  shardMonth: string
  /** YYYY-MM-DD when parsed from path/ref. */
  dateStr: string | null
}

function formatMonth(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, '0')}`
}

function monthFromNow(now: number = Date.now()): string {
  const d = new Date(now)
  return formatMonth(d.getFullYear(), d.getMonth() + 1)
}

/**
 * Resolve diary calendar date from sourceRef or file path.
 * Prefer YYYY-MM-DD; fall back to YYYY-MM then "now" for shard only.
 */
export function graphDiaryInstant(
  sourceRefOrPath: string | null | undefined,
  now: number = Date.now()
): GraphDiaryInstant {
  const raw = (sourceRefOrPath ?? '').trim().replace(/\\/g, '/')
  if (raw) {
    const full = raw.match(DATE_RE)
    if (full) {
      const y = Number(full[1])
      const m = Number(full[2])
      const day = Number(full[3])
      const dateStr = `${full[1]}-${full[2]}-${full[3]}`
      // Local calendar midnight (device TZ) — consistent with prior dateFromFilePath usage.
      const validFrom = new Date(y, m - 1, day).getTime()
      return {
        validFrom: Number.isFinite(validFrom) ? validFrom : null,
        shardMonth: formatMonth(y, m),
        dateStr
      }
    }
    const monthOnly = raw.match(/(\d{4})[-/](\d{2})(?![-/\d])/)
    if (monthOnly) {
      const y = Number(monthOnly[1])
      const m = Number(monthOnly[2])
      const shardMonth = formatMonth(y, m)
      return {
        validFrom: new Date(y, m - 1, 1).getTime(),
        shardMonth,
        dateStr: null
      }
    }
    if (MONTH_RE.test(raw)) {
      const [, ys, ms] = raw.match(MONTH_RE)!
      const y = Number(ys)
      const m = Number(ms)
      return {
        validFrom: new Date(y, m - 1, 1).getTime(),
        shardMonth: formatMonth(y, m),
        dateStr: null
      }
    }
  }
  return {
    validFrom: null,
    shardMonth: monthFromNow(now),
    dateStr: null
  }
}
