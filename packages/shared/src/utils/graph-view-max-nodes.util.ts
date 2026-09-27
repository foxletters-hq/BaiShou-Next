import {
  GRAPH_VIEW_MAX_NODES_DEFAULT,
  GRAPH_VIEW_MAX_NODES_MIN,
  GRAPH_VIEW_MAX_NODES_SLIDER_MAX,
  GRAPH_VIEW_MAX_NODES_STEP,
  GRAPH_VIEW_MAX_NODES_UNLIMITED,
  GRAPH_VIEW_SQL_UNLIMITED_LIMIT
} from './graph-view.constants'

export const GRAPH_VIEW_MAX_NODES_STORAGE_KEY = 'baishou.graph.view-max-nodes.v1'

export function isGraphViewMaxNodesUnlimited(value: unknown): boolean {
  if (value === GRAPH_VIEW_MAX_NODES_UNLIMITED) return true
  if (value === Number.POSITIVE_INFINITY) return true
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase()
    if (trimmed === 'unlimited' || trimmed === 'infinite') return true
  }
  const n = Number(value)
  if (!Number.isFinite(n)) return false
  // Negative sentinels (including the string "-1") must not become LIMIT 1 via Math.max(1, n).
  if (n < 0) return true
  return n >= GRAPH_VIEW_MAX_NODES_SLIDER_MAX
}

/** Snap to the slider step. Far-right tick and -1 mean no query LIMIT. */
export function clampGraphViewMaxNodes(value: unknown): number {
  if (isGraphViewMaxNodesUnlimited(value)) return GRAPH_VIEW_MAX_NODES_UNLIMITED
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return GRAPH_VIEW_MAX_NODES_DEFAULT
  const snapped = Math.round(n / GRAPH_VIEW_MAX_NODES_STEP) * GRAPH_VIEW_MAX_NODES_STEP
  if (snapped >= GRAPH_VIEW_MAX_NODES_SLIDER_MAX) return GRAPH_VIEW_MAX_NODES_UNLIMITED
  return Math.max(GRAPH_VIEW_MAX_NODES_MIN, snapped)
}

/** Native slider position: unlimited sits on GRAPH_VIEW_MAX_NODES_SLIDER_MAX. */
export function graphViewMaxNodesSliderValue(maxNodes: number): number {
  if (isGraphViewMaxNodesUnlimited(maxNodes)) return GRAPH_VIEW_MAX_NODES_SLIDER_MAX
  return clampGraphViewMaxNodes(maxNodes)
}

/** SQL LIMIT, or undefined when the user chose unlimited (for JS slice / omit-LIMIT paths). */
export function graphViewQueryLimit(maxNodes: unknown): number | undefined {
  if (isGraphViewMaxNodesUnlimited(maxNodes)) return undefined
  const n = Number(maxNodes)
  if (!Number.isFinite(n)) return GRAPH_VIEW_MAX_NODES_DEFAULT
  return Math.max(GRAPH_VIEW_MAX_NODES_MIN, n)
}

/**
 * Always-positive value for SQL `.limit()`.
 * Unlimited must not skip `.limit()`: the desktop knowledge driver would then return a single row.
 */
export function graphViewSqlLimit(maxNodes: unknown): number {
  return graphViewQueryLimit(maxNodes) ?? GRAPH_VIEW_SQL_UNLIMITED_LIMIT
}

export function parseGraphViewMaxNodes(raw: string | null | undefined): number {
  if (raw == null || raw === '') return GRAPH_VIEW_MAX_NODES_DEFAULT
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'number') return clampGraphViewMaxNodes(parsed)
    if (typeof parsed === 'string') return clampGraphViewMaxNodes(parsed)
    if (parsed && typeof parsed === 'object' && 'maxNodes' in parsed) {
      return clampGraphViewMaxNodes((parsed as { maxNodes: unknown }).maxNodes)
    }
  } catch {
    return clampGraphViewMaxNodes(raw)
  }
  return GRAPH_VIEW_MAX_NODES_DEFAULT
}

export function loadGraphViewMaxNodes(): number {
  try {
    if (typeof localStorage === 'undefined') return GRAPH_VIEW_MAX_NODES_DEFAULT
    return parseGraphViewMaxNodes(localStorage.getItem(GRAPH_VIEW_MAX_NODES_STORAGE_KEY))
  } catch {
    return GRAPH_VIEW_MAX_NODES_DEFAULT
  }
}

export function saveGraphViewMaxNodes(value: number): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(
      GRAPH_VIEW_MAX_NODES_STORAGE_KEY,
      JSON.stringify(clampGraphViewMaxNodes(value))
    )
  } catch {
    // ignore quota / private mode
  }
}
