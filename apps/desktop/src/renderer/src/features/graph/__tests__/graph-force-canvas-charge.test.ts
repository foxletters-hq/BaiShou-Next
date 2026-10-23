import { describe, expect, it } from 'vitest'
import { GRAPH_FORCE_ISOLATED_PAIRWISE_MAX } from '@baishou/shared'
import { createGraphAwareChargeForce } from '../graph-force-canvas-charge'
import type { GraphForceSimNode } from '../graph-force-canvas.types'

function node(id: string, x: number, y: number): GraphForceSimNode {
  return { id, name: id, nodeType: 'person', x, y, vx: 0, vy: 0 }
}

describe('createGraphAwareChargeForce', () => {
  it('should not let the connected cluster blast an isolated node away', () => {
    const degreeById = new Map([
      ['hub', 3],
      ['iso', 0]
    ])
    const hub = node('hub', 0, 0)
    const iso = node('iso', 40, 0)
    const force = createGraphAwareChargeForce()
    force.configure(-180, degreeById)
    force.initialize([hub, iso])
    force(1)
    expect(Math.abs(iso.vx ?? 0)).toBeLessThan(2)
  })

  it('should push two isolated nodes apart', () => {
    const degreeById = new Map([
      ['a', 0],
      ['b', 0]
    ])
    const a = node('a', 0, 0)
    const b = node('b', 20, 0)
    const force = createGraphAwareChargeForce()
    force.configure(-180, degreeById)
    force.initialize([a, b])
    force(1)
    expect(a.vx ?? 0).toBeLessThan(0)
    expect(b.vx ?? 0).toBeGreaterThan(0)
  })

  it('should still push two connected nodes apart', () => {
    const degreeById = new Map([
      ['a', 1],
      ['b', 1]
    ])
    const a = node('a', 0, 0)
    const b = node('b', 20, 0)
    const force = createGraphAwareChargeForce()
    force.configure(-180, degreeById, 70)
    force.initialize([a, b])
    force(1)
    expect(a.vx ?? 0).toBeLessThan(0)
    expect(b.vx ?? 0).toBeGreaterThan(0)
  })

  it('should not give velocity to a far isolated node when the isolate set uses the grid', () => {
    const clustered = Array.from({ length: GRAPH_FORCE_ISOLATED_PAIRWISE_MAX + 1 }, (_, i) =>
      node(`n${i}`, i * 4, 0)
    )
    const far = node('far', 8000, 0)
    const degreeById = new Map([['far', 0], ...clustered.map((n) => [n.id, 0] as const)])
    const force = createGraphAwareChargeForce()
    force.configure(-180, degreeById)
    force.initialize([...clustered, far])
    force(1)
    expect(Math.abs(far.vx ?? 0)).toBe(0)
  })
})
