import { describe, expect, it } from 'vitest'
import { fitGraphCameraToPoints } from '../graph-view.constants'

describe('fitGraphCameraToPoints', () => {
  it('returns null for empty points or empty view', () => {
    expect(fitGraphCameraToPoints([], 400, 300)).toBeNull()
    expect(fitGraphCameraToPoints([{ x: 0, y: 0 }], 0, 300)).toBeNull()
  })

  it('keeps two endpoints inside the viewport', () => {
    const a = { x: 0, y: 0 }
    const b = { x: 200, y: 0 }
    const fitted = fitGraphCameraToPoints([a, b], 400, 300, {
      padding: 40,
      maxK: 2,
      minK: 0.2
    })
    expect(fitted).not.toBeNull()
    const sx = (p: { x: number; y: number }) => fitted!.x + p.x * fitted!.k
    expect(sx(a)).toBeGreaterThanOrEqual(0)
    expect(sx(a)).toBeLessThanOrEqual(400)
    expect(sx(b)).toBeGreaterThanOrEqual(0)
    expect(sx(b)).toBeLessThanOrEqual(400)
  })
})
