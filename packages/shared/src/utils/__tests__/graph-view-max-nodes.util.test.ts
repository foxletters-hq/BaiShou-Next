import { describe, expect, it } from 'vitest'
import {
  GRAPH_VIEW_MAX_NODES_DEFAULT,
  GRAPH_VIEW_MAX_NODES_MIN,
  GRAPH_VIEW_MAX_NODES_SLIDER_MAX,
  GRAPH_VIEW_MAX_NODES_UNLIMITED,
  GRAPH_VIEW_SQL_UNLIMITED_LIMIT
} from '../graph-view.constants'
import {
  clampGraphViewMaxNodes,
  graphViewMaxNodesSliderValue,
  graphViewQueryLimit,
  graphViewSqlLimit,
  isGraphViewMaxNodesUnlimited,
  parseGraphViewMaxNodes
} from '../graph-view-max-nodes.util'

describe('clampGraphViewMaxNodes', () => {
  it('should return the default when the value is missing or not a number', () => {
    expect(clampGraphViewMaxNodes(undefined)).toBe(GRAPH_VIEW_MAX_NODES_DEFAULT)
    expect(clampGraphViewMaxNodes('nope')).toBe(GRAPH_VIEW_MAX_NODES_DEFAULT)
  })

  it('should snap to the slider step and keep a floor, with the far-right tick as unlimited', () => {
    expect(clampGraphViewMaxNodes(500)).toBe(500)
    expect(clampGraphViewMaxNodes(523)).toBe(500)
    expect(clampGraphViewMaxNodes(10)).toBe(GRAPH_VIEW_MAX_NODES_MIN)
    expect(clampGraphViewMaxNodes(GRAPH_VIEW_MAX_NODES_SLIDER_MAX)).toBe(
      GRAPH_VIEW_MAX_NODES_UNLIMITED
    )
    expect(clampGraphViewMaxNodes(GRAPH_VIEW_MAX_NODES_UNLIMITED)).toBe(
      GRAPH_VIEW_MAX_NODES_UNLIMITED
    )
    expect(clampGraphViewMaxNodes('unlimited')).toBe(GRAPH_VIEW_MAX_NODES_UNLIMITED)
    expect(clampGraphViewMaxNodes(GRAPH_VIEW_MAX_NODES_SLIDER_MAX - 1)).toBe(
      GRAPH_VIEW_MAX_NODES_UNLIMITED
    )
  })
})

describe('graphViewQueryLimit', () => {
  it('should omit SQL LIMIT when the cap is unlimited', () => {
    expect(graphViewQueryLimit(GRAPH_VIEW_MAX_NODES_UNLIMITED)).toBeUndefined()
    expect(graphViewQueryLimit(500)).toBe(500)
  })

  it('should omit SQL LIMIT for any negative sentinel instead of coercing to 1', () => {
    expect(Math.max(1, GRAPH_VIEW_MAX_NODES_UNLIMITED)).toBe(1)
    expect(graphViewQueryLimit(GRAPH_VIEW_MAX_NODES_UNLIMITED)).toBeUndefined()
    expect(graphViewQueryLimit(-1)).toBeUndefined()
    expect(graphViewQueryLimit('-1')).toBeUndefined()
  })
})

describe('graphViewSqlLimit', () => {
  it('should pass a large positive LIMIT when unlimited instead of skipping .limit()', () => {
    expect(graphViewSqlLimit(GRAPH_VIEW_MAX_NODES_UNLIMITED)).toBe(GRAPH_VIEW_SQL_UNLIMITED_LIMIT)
    expect(graphViewSqlLimit(-1)).toBe(GRAPH_VIEW_SQL_UNLIMITED_LIMIT)
    expect(graphViewSqlLimit(500)).toBe(500)
    expect(graphViewSqlLimit(GRAPH_VIEW_MAX_NODES_UNLIMITED)).toBeGreaterThan(1)
  })
})

describe('graphViewMaxNodesSliderValue', () => {
  it('should park unlimited on the last slider tick', () => {
    expect(graphViewMaxNodesSliderValue(GRAPH_VIEW_MAX_NODES_UNLIMITED)).toBe(
      GRAPH_VIEW_MAX_NODES_SLIDER_MAX
    )
    expect(graphViewMaxNodesSliderValue(800)).toBe(800)
  })
})

describe('isGraphViewMaxNodesUnlimited', () => {
  it('should treat the sentinel and the last slider tick as unlimited', () => {
    expect(isGraphViewMaxNodesUnlimited(GRAPH_VIEW_MAX_NODES_UNLIMITED)).toBe(true)
    expect(isGraphViewMaxNodesUnlimited(GRAPH_VIEW_MAX_NODES_SLIDER_MAX)).toBe(true)
    expect(isGraphViewMaxNodesUnlimited(500)).toBe(false)
  })

  it('should treat negative numbers and the string "-1" as unlimited', () => {
    expect(isGraphViewMaxNodesUnlimited(-1)).toBe(true)
    expect(isGraphViewMaxNodesUnlimited('-1')).toBe(true)
    expect(isGraphViewMaxNodesUnlimited(-5)).toBe(true)
  })
})

describe('parseGraphViewMaxNodes', () => {
  it('should read a bare number or a maxNodes object from storage JSON', () => {
    expect(parseGraphViewMaxNodes(null)).toBe(GRAPH_VIEW_MAX_NODES_DEFAULT)
    expect(parseGraphViewMaxNodes('500')).toBe(500)
    expect(parseGraphViewMaxNodes('{"maxNodes":800}')).toBe(800)
    expect(parseGraphViewMaxNodes(String(GRAPH_VIEW_MAX_NODES_UNLIMITED))).toBe(
      GRAPH_VIEW_MAX_NODES_UNLIMITED
    )
    expect(clampGraphViewMaxNodes('-1')).toBe(GRAPH_VIEW_MAX_NODES_UNLIMITED)
  })
})
