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

/**
 * 独立节点没有连边弹簧。连通核的全量排斥会在核外包一层「隔离带」，
 * 它们就会在带外挤成几坨。核与独立节点之间几乎不互斥，
 * 独立节点之间用中等排斥铺开，再加弱向心，才会自然散在周围。
 */
export const GRAPH_FORCE_ISOLATED_CHARGE_SCALE = 0.3
export const GRAPH_FORCE_MIXED_CHARGE_SCALE = 0.02
export const GRAPH_FORCE_ISOLATED_CENTER_SCALE = 0.45
export const GRAPH_FORCE_VELOCITY_DECAY = 0.48
export const GRAPH_FORCE_CENTER_MOVE_EPS = 0.5
export const GRAPH_FORCE_ISOLATED_SEED = {
  min: 120,
  max: 240,
  countScale: 10
} as const
export const GRAPH_FORCE_CHARGE_DISTANCE_MAX_MIN = 160
export const GRAPH_FORCE_CHARGE_DISTANCE_MAX_LINK_SCALE = 2.2

/** 一对节点的排斥比例。独立-独立要铺开；独立-连通几乎不推，避免挤出隔离带。 */
export function graphForcePairChargeScale(degreeA: number, degreeB: number): number {
  const aIso = degreeA <= 0
  const bIso = degreeB <= 0
  if (aIso && bIso) return GRAPH_FORCE_ISOLATED_CHARGE_SCALE
  if (aIso || bIso) return GRAPH_FORCE_MIXED_CHARGE_SCALE
  return 1
}

/** 独立节点之间不设排斥距离上限，否则远处的几坨互不推开。 */
export function graphForcePairUsesDistanceMax(degreeA: number, degreeB: number): boolean {
  return degreeA > 0 || degreeB > 0
}

/** 视口力心没怎么动时不改目标，避免每帧微调把节点挤来挤去。 */
export function graphForceCenterNeedsUpdate(
  prev: { x: number; y: number } | null | undefined,
  next: { x: number; y: number },
  eps = GRAPH_FORCE_CENTER_MOVE_EPS
): boolean {
  if (!prev) return true
  return Math.abs(prev.x - next.x) >= eps || Math.abs(prev.y - next.y) >= eps
}

/** 限制长程排斥，避免连通核把外圈独立节点继续推远。 */
export function graphForceChargeDistanceMax(linkDistance: number): number {
  return Math.max(
    GRAPH_FORCE_CHARGE_DISTANCE_MAX_MIN,
    linkDistance * GRAPH_FORCE_CHARGE_DISTANCE_MAX_LINK_SCALE
  )
}

/** 单个节点的 many-body 强度。独立节点只用弱排斥，避免成坨或炸开。 */
export function graphForceNodeChargeStrength(chargeStrength: number, degree: number): number {
  if (degree > 0) return chargeStrength
  return chargeStrength * GRAPH_FORCE_ISOLATED_CHARGE_SCALE
}

/** 单个节点的 forceX/Y 强度。独立节点用较弱向心，散在周围而不吸进核。 */
export function graphForceNodeCenterStrength(centerStrength: number, degree: number): number {
  if (degree > 0) return centerStrength
  return centerStrength * GRAPH_FORCE_ISOLATED_CENTER_SCALE
}

/** 独立节点初始散布半径，落在连通核外侧一圈，而不是正圆轨道。 */
export function graphForceIsolatedSeedSpread(isolatedCount: number): number {
  return Math.min(
    GRAPH_FORCE_ISOLATED_SEED.max,
    GRAPH_FORCE_ISOLATED_SEED.min +
      Math.sqrt(Math.max(0, isolatedCount)) * GRAPH_FORCE_ISOLATED_SEED.countScale
  )
}

export function graphForceIsolatedSeedOffset(
  isolatedCount: number,
  random: () => number
): { dx: number; dy: number } {
  const spread = graphForceIsolatedSeedSpread(isolatedCount)
  const angle = random() * Math.PI * 2
  const rad = Math.sqrt(random()) * spread
  return { dx: Math.cos(angle) * rad, dy: Math.sin(angle) * rad }
}

export function countIsolatedGraphForceNodes(
  nodeIds: Iterable<string>,
  degreeById: Map<string, number>
): number {
  let n = 0
  for (const id of nodeIds) {
    if ((degreeById.get(id) ?? 0) <= 0) n += 1
  }
  return n
}

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
