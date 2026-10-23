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
})
