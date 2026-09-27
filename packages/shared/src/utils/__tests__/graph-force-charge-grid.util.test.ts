import { describe, expect, it } from 'vitest'
import {
  collectGraphForceGridNeighbors,
  forEachGraphForceGridNeighbor,
  graphForceGridCellKey,
  pushGraphForceGridIndex
} from '../graph-force-charge-grid.util'

describe('graphForceGridCellKey', () => {
  it('should bucket nearby points into the same cell', () => {
    expect(graphForceGridCellKey(10, 10, 50)).toBe(graphForceGridCellKey(40, 20, 50))
    expect(graphForceGridCellKey(10, 10, 50)).not.toBe(graphForceGridCellKey(80, 10, 50))
  })
})

describe('collectGraphForceGridNeighbors', () => {
  it('should include indexes from adjacent cells and skip far ones', () => {
    const grid = new Map<string, number[]>()
    pushGraphForceGridIndex(grid, 0, 10, 10, 50)
    pushGraphForceGridIndex(grid, 1, 60, 10, 50)
    pushGraphForceGridIndex(grid, 2, 400, 400, 50)
    expect(collectGraphForceGridNeighbors(grid, 10, 10, 50).sort()).toEqual([0, 1])
  })
})

describe('forEachGraphForceGridNeighbor', () => {
  it('should visit the same neighbors without allocating a list first', () => {
    const grid = new Map<string, number[]>()
    pushGraphForceGridIndex(grid, 0, 10, 10, 50)
    pushGraphForceGridIndex(grid, 1, 60, 10, 50)
    const seen: number[] = []
    forEachGraphForceGridNeighbor(grid, 10, 10, 50, (index) => {
      seen.push(index)
    })
    expect(seen.sort()).toEqual([0, 1])
  })
})
