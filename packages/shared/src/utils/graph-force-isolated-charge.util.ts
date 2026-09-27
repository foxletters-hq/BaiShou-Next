import {
  forEachGraphForceGridNeighbor,
  pushGraphForceGridIndex
} from './graph-force-charge-grid.util'
import {
  GRAPH_FORCE_ISOLATED_GRID_CELL,
  graphForcePairChargeScale,
  graphForceShouldUseIsolatedChargeGrid
} from './graph-force-settings.util'

export type GraphForceChargePoint = {
  x?: number | null
  y?: number | null
  vx?: number | null
  vy?: number | null
}

function applyIsolatedChargePair(
  a: GraphForceChargePoint,
  b: GraphForceChargePoint,
  strength: number,
  alpha: number
): void {
  const dx = (a.x ?? 0) - (b.x ?? 0)
  const dy = (a.y ?? 0) - (b.y ?? 0)
  const dist2 = dx * dx + dy * dy || 1
  const k = (Math.abs(strength) * alpha) / dist2
  a.vx = (a.vx ?? 0) + dx * k
  a.vy = (a.vy ?? 0) + dy * k
  b.vx = (b.vx ?? 0) - dx * k
  b.vy = (b.vy ?? 0) - dy * k
}

/** 独立节点互相推开。数量一多就只算网格邻居，避免两两 O(n²)。 */
export function applyGraphForceIsolatedPairCharge(
  isolated: GraphForceChargePoint[],
  chargeStrength: number,
  alpha: number
): void {
  if (isolated.length < 2) return
  const strength = chargeStrength * graphForcePairChargeScale(0, 0)
  if (strength === 0) return

  if (!graphForceShouldUseIsolatedChargeGrid(isolated.length)) {
    for (let i = 0; i < isolated.length; i++) {
      const a = isolated[i]!
      for (let j = i + 1; j < isolated.length; j++) {
        applyIsolatedChargePair(a, isolated[j]!, strength, alpha)
      }
    }
    return
  }

  const cell = GRAPH_FORCE_ISOLATED_GRID_CELL
  const grid = new Map<string, number[]>()
  for (let i = 0; i < isolated.length; i++) {
    const n = isolated[i]!
    pushGraphForceGridIndex(grid, i, n.x ?? 0, n.y ?? 0, cell)
  }
  for (let i = 0; i < isolated.length; i++) {
    const a = isolated[i]!
    forEachGraphForceGridNeighbor(grid, a.x ?? 0, a.y ?? 0, cell, (j) => {
      if (j <= i) return
      applyIsolatedChargePair(a, isolated[j]!, strength, alpha)
    })
  }
}
