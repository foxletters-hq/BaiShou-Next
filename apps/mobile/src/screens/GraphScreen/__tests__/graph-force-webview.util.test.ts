import { describe, expect, it } from 'vitest'
import {
  GRAPH_MOBILE_LABEL_ZOOM_HUB,
  GRAPH_MOBILE_LABEL_ZOOM_ISOLATED,
  graphMetaFingerprint,
  graphMobileHitRadius,
  graphMobileNodeRadius,
  graphMobileSettleSteps,
  setToArray,
  shouldShowMobileGraphLabel,
  topologyFingerprint
} from '../graph-force-webview.util'

describe('topologyFingerprint', () => {
  it('should stay stable when node and edge order changes', () => {
    const a = topologyFingerprint(
      [
        { id: 'b', name: 'B', nodeType: 'person' },
        { id: 'a', name: 'A', nodeType: 'person' }
      ],
      [
        { id: 'e2', fromId: 'a', toId: 'b', edgeType: 'relates_to' },
        { id: 'e1', fromId: 'b', toId: 'a', edgeType: 'relates_to' }
      ]
    )
    const b = topologyFingerprint(
      [
        { id: 'a', name: 'A', nodeType: 'person' },
        { id: 'b', name: 'B', nodeType: 'person' }
      ],
      [
        { id: 'e1', fromId: 'b', toId: 'a', edgeType: 'relates_to' },
        { id: 'e2', fromId: 'a', toId: 'b', edgeType: 'relates_to' }
      ]
    )
    expect(a).toBe(b)
  })
})

describe('setToArray', () => {
  it('should return an empty list when the set is missing or empty', () => {
    expect(setToArray(null)).toEqual([])
    expect(setToArray(new Set())).toEqual([])
  })

  it('should copy the ids when the set has values', () => {
    expect(setToArray(new Set(['a', 'b']))).toEqual(['a', 'b'])
  })
})

describe('graphMobileNodeRadius', () => {
  it('should keep the default mobile dot smaller than the previous 7px floor', () => {
    expect(graphMobileNodeRadius(1, 1)).toBeLessThan(6)
    expect(graphMobileNodeRadius(1, 1)).toBeGreaterThan(2)
    expect(graphMobileNodeRadius(80, 1)).toBeLessThan(10)
  })
})

describe('graphMobileHitRadius', () => {
  it('should keep a finger-sized target when the drawn dot is tiny', () => {
    expect(graphMobileHitRadius(1, 1, 1)).toBeGreaterThanOrEqual(14)
    expect(graphMobileHitRadius(1, 1, 2)).toBeLessThan(graphMobileHitRadius(1, 1, 0.5))
  })
})

describe('graphMobileSettleSteps', () => {
  it('should use fewer ticks when the graph is large', () => {
    expect(graphMobileSettleSteps(80)).toBe(200)
    expect(graphMobileSettleSteps(500)).toBe(120)
    expect(graphMobileSettleSteps(2000)).toBe(60)
  })
})

describe('shouldShowMobileGraphLabel', () => {
  const base = {
    textAlpha: 1,
    dim: false,
    nodeId: 'n',
    selectedId: null as string | null,
    highlighted: false,
    focusing: false,
    inFocus: false,
    isHub: false
  }

  it('should hide names when zoomed out except for the selected node', () => {
    expect(
      shouldShowMobileGraphLabel({
        ...base,
        isHub: true,
        zoomK: GRAPH_MOBILE_LABEL_ZOOM_HUB - 0.2
      })
    ).toBe(false)
    expect(
      shouldShowMobileGraphLabel({
        ...base,
        isHub: true,
        isolated: true,
        zoomK: GRAPH_MOBILE_LABEL_ZOOM_ISOLATED - 0.1
      })
    ).toBe(false)
    expect(shouldShowMobileGraphLabel({ ...base, selectedId: 'n', zoomK: 0.3 })).toBe(true)
  })

  it('should show hub names after zooming in', () => {
    expect(
      shouldShowMobileGraphLabel({
        ...base,
        isHub: true,
        isolated: false,
        zoomK: GRAPH_MOBILE_LABEL_ZOOM_HUB
      })
    ).toBe(true)
  })
})

describe('graphMetaFingerprint', () => {
  it('should change when a node name changes even if ids stay the same', () => {
    const edges = [{ id: 'e', fromId: 'a', toId: 'b', edgeType: 'relates_to' }]
    const before = graphMetaFingerprint([{ id: 'a', name: '甲', nodeType: 'person' }], edges)
    const after = graphMetaFingerprint([{ id: 'a', name: '乙', nodeType: 'person' }], edges)
    expect(before).not.toBe(after)
  })
})
