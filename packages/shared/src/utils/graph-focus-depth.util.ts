/** Focus neighborhood depth for graph selection (N-hop cascade). */

export const GRAPH_FOCUS_DEPTH_OPTIONS = [1, 2, 3] as const

export type GraphFocusDepth = (typeof GRAPH_FOCUS_DEPTH_OPTIONS)[number]

export const GRAPH_FOCUS_DEPTH_DEFAULT: GraphFocusDepth = 1

const STORAGE_KEY = 'baishou.graph.focusDepth.v1'

export const GRAPH_FOCUS_DEPTH_STORAGE_KEY = STORAGE_KEY

export function clampGraphFocusDepth(value: unknown): GraphFocusDepth {
  const n = Number(value)
  if (n === 2 || n === 3) return n
  return 1
}

export function loadGraphFocusDepth(): GraphFocusDepth {
  try {
    if (typeof localStorage === 'undefined') return GRAPH_FOCUS_DEPTH_DEFAULT
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null) return GRAPH_FOCUS_DEPTH_DEFAULT
    return clampGraphFocusDepth(JSON.parse(raw))
  } catch {
    return GRAPH_FOCUS_DEPTH_DEFAULT
  }
}

export function saveGraphFocusDepth(depth: GraphFocusDepth): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clampGraphFocusDepth(depth)))
  } catch {
    // ignore
  }
}

type EdgeLike = {
  fromId: string
  toId: string
  reviewStatus?: string
}

/** Collect center + nodes within `depth` hops over undirected edges. */
export function collectGraphFocusIds(
  centerId: string,
  edges: EdgeLike[],
  depth: number
): Set<string> {
  const ids = new Set<string>([centerId])
  if (depth <= 0) return ids
  let frontier = new Set<string>([centerId])
  const hops = Math.min(Math.max(1, Math.floor(depth)), 8)
  for (let d = 0; d < hops; d++) {
    const next = new Set<string>()
    for (const e of edges) {
      if (e.reviewStatus === 'rejected') continue
      const fromIn = frontier.has(e.fromId)
      const toIn = frontier.has(e.toId)
      if (fromIn && !ids.has(e.toId)) {
        ids.add(e.toId)
        next.add(e.toId)
      }
      if (toIn && !ids.has(e.fromId)) {
        ids.add(e.fromId)
        next.add(e.fromId)
      }
    }
    if (next.size === 0) break
    frontier = next
  }
  return ids
}
