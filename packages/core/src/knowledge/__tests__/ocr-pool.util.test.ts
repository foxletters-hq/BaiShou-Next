import { describe, expect, it } from 'vitest'
import { clampOcrConcurrency, runPool } from '../extract-engines/pool.util'

describe('clampOcrConcurrency', () => {
  it('clamps to 1–10', () => {
    expect(clampOcrConcurrency(undefined)).toBe(1)
    expect(clampOcrConcurrency(0)).toBe(1)
    expect(clampOcrConcurrency(2)).toBe(2)
    expect(clampOcrConcurrency(9)).toBe(9)
    expect(clampOcrConcurrency(11)).toBe(10)
    expect(clampOcrConcurrency(1.8)).toBe(1)
  })
})

describe('runPool', () => {
  it('respects concurrency and preserves completion', async () => {
    let inflight = 0
    let maxInflight = 0
    const seen: number[] = []
    await runPool([1, 2, 3, 4, 5], 2, async (n) => {
      inflight++
      maxInflight = Math.max(maxInflight, inflight)
      await new Promise((r) => setTimeout(r, 5))
      seen.push(n)
      inflight--
    })
    expect(seen.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5])
    expect(maxInflight).toBeLessThanOrEqual(2)
    expect(maxInflight).toBeGreaterThanOrEqual(1)
  })
})
