import { describe, expect, it } from 'vitest'
import { createGraphForceTickDrawScheduler } from '../graph-force-canvas-simulation'

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
