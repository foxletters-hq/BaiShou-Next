/** Month-range helpers for graph global view (YYYY-MM inclusive). */

export type GraphMonthRange = {
  startMonth: string
  endMonth: string
}

const MONTH_RE = /^\d{4}-\d{2}$/

export function isValidGraphMonth(value: string | null | undefined): boolean {
  return typeof value === 'string' && MONTH_RE.test(value)
}

export function formatGraphMonth(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** Inclusive last N calendar months ending at `now`'s month. Default N=3. */
export function defaultGraphMonthRange(now: Date = new Date(), months = 3): GraphMonthRange {
  const count = Math.max(1, Math.floor(months))
  const end = new Date(now.getFullYear(), now.getMonth(), 1)
  const start = new Date(now.getFullYear(), now.getMonth() - (count - 1), 1)
  return {
    startMonth: formatGraphMonth(start),
    endMonth: formatGraphMonth(end)
  }
}

export function clampGraphMonthRange(
  partial: Partial<GraphMonthRange> | null | undefined,
  now: Date = new Date()
): GraphMonthRange {
  const fallback = defaultGraphMonthRange(now)
  let start = isValidGraphMonth(partial?.startMonth) ? partial!.startMonth! : fallback.startMonth
  let end = isValidGraphMonth(partial?.endMonth) ? partial!.endMonth! : fallback.endMonth
  if (start > end) {
    const tmp = start
    start = end
    end = tmp
  }
  return { startMonth: start, endMonth: end }
}

export function isDefaultGraphMonthRange(
  range: GraphMonthRange,
  now: Date = new Date(),
  months = 3
): boolean {
  const d = defaultGraphMonthRange(now, months)
  return range.startMonth === d.startMonth && range.endMonth === d.endMonth
}

export function parseGraphMonthToDate(month: string): Date {
  const [y, m] = month.split('-').map(Number)
  return new Date(y!, (m ?? 1) - 1, 1)
}

/**
 * Resolve the diary month an edge belongs to.
 * Prefer shardMonth, then YYYY-MM(-DD) inside sourceRef, then createdAt.
 */
export function resolveGraphEdgeMonth(edge: {
  shardMonth?: string | null
  sourceRef?: string | null
  createdAt?: number | null
}): string | null {
  const shard = edge.shardMonth?.trim() ?? ''
  if (isValidGraphMonth(shard)) return shard
  const ref = edge.sourceRef?.trim() ?? ''
  if (ref) {
    const m = ref.match(/(\d{4})[-/](\d{2})/)
    if (m) return `${m[1]}-${m[2]}`
  }
  const createdAt = edge.createdAt
  if (typeof createdAt === 'number' && Number.isFinite(createdAt) && createdAt > 0) {
    return formatGraphMonth(new Date(createdAt))
  }
  return null
}

export function isGraphEdgeInMonthRange(
  edge: {
    shardMonth?: string | null
    sourceRef?: string | null
    createdAt?: number | null
  },
  range: GraphMonthRange
): boolean {
  const month = resolveGraphEdgeMonth(edge)
  if (!month) return false
  const { startMonth, endMonth } = clampGraphMonthRange(range)
  return month >= startMonth && month <= endMonth
}

const STORAGE_KEY = 'baishou.graph.monthRange.v1'

export const GRAPH_MONTH_RANGE_STORAGE_KEY = STORAGE_KEY

export function loadGraphMonthRange(): GraphMonthRange {
  try {
    if (typeof localStorage === 'undefined') return defaultGraphMonthRange()
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultGraphMonthRange()
    return clampGraphMonthRange(JSON.parse(raw) as Partial<GraphMonthRange>)
  } catch {
    return defaultGraphMonthRange()
  }
}

export function saveGraphMonthRange(range: GraphMonthRange): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clampGraphMonthRange(range)))
  } catch {
    // ignore
  }
}
