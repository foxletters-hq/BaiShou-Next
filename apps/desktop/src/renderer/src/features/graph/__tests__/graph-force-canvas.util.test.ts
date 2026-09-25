import { describe, expect, it } from 'vitest'
import {
  buildGraphCanvasDegreeMap,
  easeOutCubic,
  filterGraphCanvasTopology,
  findGraphCanvasNodeAtPoint,
  graphCanvasApplyZoom,
  graphCanvasCameraFitIds,
  graphCanvasHitRadius,
  graphCanvasNodeRadius,
  graphCanvasTopologyFingerprint,
  graphCanvasWorldPoint,
  graphForceCameraTargetForPoints,
  isGraphCanvasPending,
  isGraphCanvasRejected,
  seedGraphForceNodePosition,
  shouldShowGraphCanvasLabel
} from '../graph-force-canvas.util'

describe('easeOutCubic', () => {
  it('should start at 0, end at 1, and ease faster near the end', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5)
  })
})

describe('review status helpers', () => {
  it('should recognize rejected and pending review statuses', () => {
    expect(isGraphCanvasRejected('rejected')).toBe(true)
    expect(isGraphCanvasRejected('pending')).toBe(false)
    expect(isGraphCanvasPending('pending')).toBe(true)
    expect(isGraphCanvasPending('approved')).toBe(false)
  })
})

describe('radius / hit test / world point', () => {
  it('should scale node and hit radii by mention count and appearance', () => {
    expect(graphCanvasNodeRadius(1, 1)).toBe(6 + 1.2)
    expect(graphCanvasNodeRadius(100, 2)).toBe((6 + 10) * 2)
    expect(graphCanvasHitRadius(undefined, 1)).toBe(8 + 1.2)
  })

  it('should hit the top-most node whose circle contains the point', () => {
    const nodes = [
      { id: 'under', x: 0, y: 0, mentionCount: 1 },
      { id: 'over', x: 0, y: 0, mentionCount: 1 }
    ]
    expect(findGraphCanvasNodeAtPoint(nodes, 0, 0, 1)?.id).toBe('over')
    expect(findGraphCanvasNodeAtPoint(nodes, 80, 80, 1)).toBeNull()
    expect(findGraphCanvasNodeAtPoint([{ id: 'no-pos' }], 0, 0, 1)).toBeNull()
  })

  it('should zoom toward the cursor and clamp the scale', () => {
    const next = graphCanvasApplyZoom({ x: 10, y: 20, k: 1 }, 100, 80, -10)
    expect(next).toEqual({
      x: 100 - (100 - 10) * 1.1,
      y: 80 - (80 - 20) * 1.1,
      k: 1.1
    })
    expect(graphCanvasApplyZoom({ x: 0, y: 0, k: 3 }, 0, 0, -10)).toBeNull()
    expect(graphCanvasApplyZoom({ x: 0, y: 0, k: 0.3 }, 0, 0, 10)).toBeNull()
  })

  it('should invert the camera transform into world coordinates', () => {
    expect(graphCanvasWorldPoint(120, 80, { left: 20, top: 10 }, { x: 10, y: 10, k: 2 })).toEqual({
      x: 45,
      y: 30
    })
  })
})

describe('camera target / fit ids', () => {
  it('should center a single point and reject empty geometry', () => {
    expect(graphForceCameraTargetForPoints([{ x: 10, y: 20 }], 200, 100, 2)).toEqual({
      x: 100 - 20,
      y: 50 - 40,
      k: 2
    })
    expect(graphForceCameraTargetForPoints([], 200, 100, 2)).toBeNull()
    expect(graphForceCameraTargetForPoints([{ x: 0, y: 0 }], 0, 100, 1)).toBeNull()
  })

  it('should fit multiple points instead of using the single-node formula', () => {
    const target = graphForceCameraTargetForPoints(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ],
      400,
      300,
      2
    )
    expect(target).not.toBeNull()
    expect(target?.k).toBeLessThanOrEqual(2)
  })

  it('should prefer locate ids over the selected node', () => {
    expect(graphCanvasCameraFitIds(['a', 'b'], 'c')).toEqual(['a', 'b'])
    expect(graphCanvasCameraFitIds([], 'c')).toEqual(['c'])
    expect(graphCanvasCameraFitIds(undefined, null)).toEqual([])
  })
})

describe('topology helpers', () => {
  it('should drop rejected nodes and edges that lose an endpoint', () => {
    const { nodes, links } = filterGraphCanvasTopology(
      [
        { id: 'a', name: 'A', nodeType: 'person' },
        { id: 'b', name: 'B', nodeType: 'person', reviewStatus: 'rejected' },
        { id: 'c', name: 'C', nodeType: 'place' }
      ],
      [
        { id: 'keep', fromId: 'a', toId: 'c', edgeType: 'relates_to' },
        { id: 'drop-end', fromId: 'a', toId: 'b', edgeType: 'relates_to' },
        {
          id: 'drop-status',
          fromId: 'a',
          toId: 'c',
          edgeType: 'relates_to',
          reviewStatus: 'rejected'
        }
      ]
    )
    expect(nodes.map((n) => n.id)).toEqual(['a', 'c'])
    expect(links.map((l) => l.id)).toEqual(['keep'])
    expect(links[0]).toMatchObject({ source: 'a', target: 'c' })
  })

  it('should fingerprint topology in sorted id order and count undirected degree', () => {
    expect(graphCanvasTopologyFingerprint(['b', 'a'], ['2', '1'])).toBe('a,b|1,2')
    const degree = buildGraphCanvasDegreeMap([
      { source: 'a', target: 'b' },
      { source: { id: 'b' }, target: { id: 'c' } }
    ])
    expect(degree.get('a')).toBe(1)
    expect(degree.get('b')).toBe(2)
    expect(degree.get('c')).toBe(1)
  })
})

describe('shouldShowGraphCanvasLabel', () => {
  const base = {
    textAlpha: 1,
    dim: false,
    nodeId: 'n',
    selectedId: null as string | null,
    multiSelected: false,
    highlighted: false,
    focusing: false,
    inFocus: false,
    isHub: false
  }

  it('should hide labels when text is off or the node is dimmed', () => {
    expect(shouldShowGraphCanvasLabel({ ...base, textAlpha: 0, isHub: true })).toBe(false)
    expect(shouldShowGraphCanvasLabel({ ...base, dim: true, isHub: true })).toBe(false)
  })

  it('should show a label for selection, highlight, focus, or hub', () => {
    expect(shouldShowGraphCanvasLabel({ ...base, selectedId: 'n' })).toBe(true)
    expect(shouldShowGraphCanvasLabel({ ...base, highlighted: true })).toBe(true)
    expect(shouldShowGraphCanvasLabel({ ...base, focusing: true, inFocus: true })).toBe(true)
    expect(shouldShowGraphCanvasLabel({ ...base, isHub: true })).toBe(true)
    expect(shouldShowGraphCanvasLabel(base)).toBe(false)
  })
})

describe('seedGraphForceNodePosition', () => {
  it('should reuse the previous position when not locating the selected node', () => {
    expect(
      seedGraphForceNodePosition({
        prev: { x: 3, y: 4, vx: 1, vy: 2 },
        locating: false,
        isSelected: false,
        cx: 100,
        cy: 80,
        nodeCount: 4
      })
    ).toEqual({ x: 3, y: 4, vx: 1, vy: 2 })
  })

  it('should seed the selected node at the viewport center while locating', () => {
    expect(
      seedGraphForceNodePosition({
        prev: { x: 3, y: 4, vx: 1, vy: 2 },
        locating: true,
        isSelected: true,
        cx: 100,
        cy: 80,
        nodeCount: 4
      })
    ).toEqual({ x: 100, y: 80, vx: 0, vy: 0 })
  })

  it('should scatter a new node on a disk when there is no previous position', () => {
    const pos = seedGraphForceNodePosition({
      locating: false,
      isSelected: false,
      cx: 0,
      cy: 0,
      nodeCount: 9,
      random: () => 0.25
    })
    expect(pos.x).not.toBe(0)
    expect(pos.y).not.toBe(0)
    expect(Math.hypot(pos.x, pos.y)).toBeLessThanOrEqual(80 + Math.sqrt(9) * 12)
  })

  it('should seed an isolated node on the outer disk instead of the core', () => {
    const pos = seedGraphForceNodePosition({
      locating: false,
      isSelected: false,
      isolated: true,
      isolatedCount: 16,
      cx: 0,
      cy: 0,
      nodeCount: 20,
      random: () => 0.25
    })
    const radius = Math.hypot(pos.x, pos.y)
    expect(radius).toBeGreaterThan(0)
    expect(radius).toBeLessThanOrEqual(240)
  })
})
