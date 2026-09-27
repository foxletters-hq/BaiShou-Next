/** Shared graph UI / query caps (desktop + mobile). */

/** Default canvas query cap; the user can raise or lower it in graph settings. */
export const GRAPH_VIEW_MAX_NODES_DEFAULT = 500
export const GRAPH_VIEW_MAX_NODES_MIN = 50
/** Last finite slider tick; one more step is unlimited. */
export const GRAPH_VIEW_MAX_NODES_FINITE_MAX = 2000
export const GRAPH_VIEW_MAX_NODES_STEP = 50
/** Slider far-right tick. Stored as GRAPH_VIEW_MAX_NODES_UNLIMITED. */
export const GRAPH_VIEW_MAX_NODES_SLIDER_MAX =
  GRAPH_VIEW_MAX_NODES_FINITE_MAX + GRAPH_VIEW_MAX_NODES_STEP
/** Stored sentinel: canvas query is not capped to a slider value. */
export const GRAPH_VIEW_MAX_NODES_UNLIMITED = -1
/**
 * SQL `.limit()` 占位：滑条选无限时也必须带 limit。
 * 桌面知识库驱动在没有 `.limit()` 时只会返回 1 行。
 */
export const GRAPH_VIEW_SQL_UNLIMITED_LIMIT = 1_000_000
/** Slider `max` including the unlimited tick. */
export const GRAPH_VIEW_MAX_NODES_MAX = GRAPH_VIEW_MAX_NODES_SLIDER_MAX

/** Alias kept for query callers that still import this name. */
export const GRAPH_GLOBAL_MAX_NODES = GRAPH_VIEW_MAX_NODES_DEFAULT

/** Chunk size for SQLite IN (...) to stay under variable limits (from+to doubles). */
export const GRAPH_SQL_IN_CHUNK = 400

/** JS cosine fallback must not load the whole vault. */
export const GRAPH_VECTOR_JS_FALLBACK_SCAN_LIMIT = 2000

/**
 * Per-hop neighbor cap for traverse prune — same value as hubDegreeThreshold
 * on findShortestPath / findPathsFrom.
 */
export const GRAPH_MAX_NEIGHBORS_PER_HOP = 40

/** Review queue listing cap (pending nodes / edges). */
export const GRAPH_PENDING_LIST_LIMIT = 400

/** Node type → canvas color (desktop Canvas + mobile WebView). */
export const GRAPH_NODE_TYPE_COLORS: Record<string, string> = {
  person: '#3b82f6',
  place: '#22c55e',
  organization: '#a855f7',
  event: '#f59e0b',
  emotion: '#ec4899',
  topic: '#64748b',
  work: '#0ea5e9',
  activity: '#14b8a6',
  product: '#8b5cf6',
  food: '#f97316',
  entry: '#94a3b8',
  source: '#64748b'
}

export const GRAPH_NODE_TYPE_COLOR_FALLBACK = '#64748b'

/** Canvas chrome — follow system appearance; do not hardcode a single product theme. */
export const GRAPH_CANVAS_THEME = {
  light: {
    background: '#f8fafc',
    label: '#0f172a',
    hint: '#64748b',
    edge: 'rgba(100,116,139,0.45)',
    edgePending: 'rgba(100,116,139,0.22)',
    edgeHighlight: '#5BA8F5',
    highlight: '#0f172a'
  },
  dark: {
    background: '#0f172a',
    label: '#e2e8f0',
    hint: '#94a3b8',
    edge: 'rgba(148,163,184,0.45)',
    edgePending: 'rgba(148,163,184,0.22)',
    edgeHighlight: '#5BA8F5',
    highlight: '#e2e8f0'
  }
} as const

export type GraphCanvasThemeScheme = keyof typeof GRAPH_CANVAS_THEME

export function graphNodeTypeColor(nodeType: string): string {
  return GRAPH_NODE_TYPE_COLORS[nodeType] || GRAPH_NODE_TYPE_COLOR_FALLBACK
}

/** Fit a camera so the given world points stay inside the view. */
export function fitGraphCameraToPoints(
  points: Array<{ x: number; y: number }>,
  viewW: number,
  viewH: number,
  opts?: { padding?: number; maxK?: number; minK?: number }
): { x: number; y: number; k: number } | null {
  if (points.length === 0 || viewW <= 0 || viewH <= 0) return null
  let minX = points[0]!.x
  let maxX = minX
  let minY = points[0]!.y
  let maxY = minY
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const padding = opts?.padding ?? 72
  const spanX = Math.max(maxX - minX, 8)
  const spanY = Math.max(maxY - minY, 8)
  const bw = spanX + padding * 2
  const bh = spanY + padding * 2
  const maxK = opts?.maxK ?? 1.85
  const minK = opts?.minK ?? 0.35
  const k = Math.min(maxK, Math.max(minK, Math.min(viewW / bw, viewH / bh)))
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return { x: viewW / 2 - cx * k, y: viewH / 2 - cy * k, k }
}
