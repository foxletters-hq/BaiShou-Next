import { describe, expect, it } from 'vitest'
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
})
