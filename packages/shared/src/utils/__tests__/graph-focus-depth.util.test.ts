import { describe, expect, it } from 'vitest'
import { clampGraphFocusDepth, collectGraphFocusIds } from '../graph-focus-depth.util'

describe('graph-focus-depth.util', () => {
  const edges = [
    { fromId: 'a', toId: 'b' },
    { fromId: 'b', toId: 'c' },
    { fromId: 'c', toId: 'd' },
    { fromId: 'x', toId: 'y', reviewStatus: 'rejected' as const }
  ]

  it('clamps depth', () => {
    expect(clampGraphFocusDepth(1)).toBe(1)
    expect(clampGraphFocusDepth(2)).toBe(2)
    expect(clampGraphFocusDepth(9)).toBe(1)
  })

  it('collects N-hop neighbors', () => {
    expect([...collectGraphFocusIds('a', edges, 1)].sort()).toEqual(['a', 'b'])
    expect([...collectGraphFocusIds('a', edges, 2)].sort()).toEqual(['a', 'b', 'c'])
    expect([...collectGraphFocusIds('a', edges, 3)].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('skips rejected edges', () => {
    expect(collectGraphFocusIds('x', edges, 2).has('y')).toBe(false)
  })
})
