/** Shared defaults for graph force layout (desktop canvas + mobile webview). */

export const GRAPH_FORCE_DEFAULTS = {
  /** Pull toward viewport center (d3 forceX/Y strength). */
  centerStrength: 0.08,
  /** Link spring attraction (d3 forceLink strength). */
  linkStrength: 0.4,
  /** Node repulsion (d3 manyBody strength, negative = repel). */
  chargeStrength: -180,
  /** Ideal link length (d3 forceLink distance). */
  linkDistance: 70
} as const

export const GRAPH_FORCE_RANGES = {
  centerStrength: { min: 0, max: 1, step: 0.01 },
  linkStrength: { min: 0, max: 1, step: 0.01 },
  chargeStrength: { min: -400, max: -20, step: 10 },
  linkDistance: { min: 20, max: 400, step: 5 }
} as const

const STORAGE_KEY = 'baishou.graph.force.v1'

export const GRAPH_FORCE_STORAGE_KEY = STORAGE_KEY

export type GraphForceSettings = {
  centerStrength: number
  linkStrength: number
  chargeStrength: number
  linkDistance: number
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function clampGraphForceSettings(
  partial: Partial<GraphForceSettings> | null | undefined
): GraphForceSettings {
  const c = Number(partial?.centerStrength)
  const l = Number(partial?.linkStrength)
  const q = Number(partial?.chargeStrength)
  const d = Number(partial?.linkDistance)
  return {
    centerStrength: clamp(
      Number.isFinite(c) ? c : GRAPH_FORCE_DEFAULTS.centerStrength,
      GRAPH_FORCE_RANGES.centerStrength.min,
      GRAPH_FORCE_RANGES.centerStrength.max
    ),
    linkStrength: clamp(
      Number.isFinite(l) ? l : GRAPH_FORCE_DEFAULTS.linkStrength,
      GRAPH_FORCE_RANGES.linkStrength.min,
      GRAPH_FORCE_RANGES.linkStrength.max
    ),
    chargeStrength: clamp(
      Number.isFinite(q) ? q : GRAPH_FORCE_DEFAULTS.chargeStrength,
      GRAPH_FORCE_RANGES.chargeStrength.min,
      GRAPH_FORCE_RANGES.chargeStrength.max
    ),
    linkDistance: clamp(
      Number.isFinite(d) ? d : GRAPH_FORCE_DEFAULTS.linkDistance,
      GRAPH_FORCE_RANGES.linkDistance.min,
      GRAPH_FORCE_RANGES.linkDistance.max
    )
  }
}

export function loadGraphForceSettings(): GraphForceSettings {
  try {
    if (typeof localStorage === 'undefined') return { ...GRAPH_FORCE_DEFAULTS }
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...GRAPH_FORCE_DEFAULTS }
    return clampGraphForceSettings(JSON.parse(raw) as Partial<GraphForceSettings>)
  } catch {
    return { ...GRAPH_FORCE_DEFAULTS }
  }
}

export function saveGraphForceSettings(settings: GraphForceSettings) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clampGraphForceSettings(settings)))
  } catch {
    // ignore quota / private mode
  }
}
