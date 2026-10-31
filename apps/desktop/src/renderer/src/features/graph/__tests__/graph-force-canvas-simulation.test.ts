import { describe, expect, it } from 'vitest'
import { forceSimulation, type Simulation } from 'd3-force'
import {
  createGraphForceTickDrawScheduler,
  graphForcePrewarmTicks,
  prewarmGraphForceSimulation
} from '../graph-force-canvas-simulation'
import type { GraphForceSimLink, GraphForceSimNode } from '../graph-force-canvas.types'

describe('createGraphForceTickDrawScheduler', () => {
  it('should draw once when several ticks arrive before the scheduled frame', () => {
    let draws = 0
    let flush: (() => void) | null = null
    const onTick = createGraphForceTickDrawScheduler(
      () => {
        draws += 1
      },
      (cb) => {
        flush = cb
      }
    )
    onTick()
    onTick()
    onTick()
    expect(draws).toBe(0)
    flush?.()
    expect(draws).toBe(1)
  })
})

describe('prewarmGraphForceSimulation', () => {
  it('should use fewer ticks for larger graphs', () => {
    expect(graphForcePrewarmTicks(80)).toBe(200)
    expect(graphForcePrewarmTicks(500)).toBe(120)
    expect(graphForcePrewarmTicks(2000)).toBe(60)
  })

  it('should settle synchronously before the first paint and keep a low alpha', () => {
    const sim = forceSimulation([]) as Simulation<GraphForceSimNode, GraphForceSimLink>
    sim.stop()
    prewarmGraphForceSimulation(sim, 20)
    expect(sim.alpha()).toBeCloseTo(0.1)
  })

  it('should preserve existing node positions without ticking when skipTicks is true', () => {
    const nodes: GraphForceSimNode[] = [
      { id: 'a', name: 'A', nodeType: 'person', x: 120, y: 240, vx: 0, vy: 0 }
    ]
    const sim = forceSimulation(nodes) as Simulation<GraphForceSimNode, GraphForceSimLink>
    sim.stop()
    prewarmGraphForceSimulation(sim, nodes.length, { skipTicks: true })
    expect(nodes[0]!.x).toBe(120)
    expect(nodes[0]!.y).toBe(240)
    expect(sim.alpha()).toBeCloseTo(0.1)
  })
})
