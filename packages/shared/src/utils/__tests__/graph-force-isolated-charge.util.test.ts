import { describe, expect, it } from 'vitest'
import { GRAPH_FORCE_ISOLATED_PAIRWISE_MAX } from '../graph-force-settings.util'
import { applyGraphForceIsolatedPairCharge } from '../graph-force-isolated-charge.util'

function point(x: number, y: number) {
  return { x, y, vx: 0, vy: 0 }
}

describe('applyGraphForceIsolatedPairCharge', () => {
  it('should push two nearby isolated points apart', () => {
    const a = point(0, 0)
    const b = point(20, 0)
    applyGraphForceIsolatedPairCharge([a, b], -180, 1)
    expect(a.vx).toBeLessThan(0)
    expect(b.vx).toBeGreaterThan(0)
  })

  it('should ignore a far isolated point when the set is large enough to use the grid', () => {
    const clustered = Array.from({ length: GRAPH_FORCE_ISOLATED_PAIRWISE_MAX + 1 }, (_, i) =>
      point(i * 4, 0)
    )
    const far = point(8000, 0)
    applyGraphForceIsolatedPairCharge([...clustered, far], -180, 1)
    expect(Math.abs(far.vx ?? 0)).toBe(0)
    expect(clustered[0]!.vx).toBeLessThan(0)
  })
})
