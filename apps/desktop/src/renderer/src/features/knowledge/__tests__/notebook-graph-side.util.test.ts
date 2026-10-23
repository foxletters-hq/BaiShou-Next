import { describe, expect, it } from 'vitest'
import {
  NOTEBOOK_GRAPH_SIDE_WIDTH_DEFAULT,
  NOTEBOOK_GRAPH_SIDE_WIDTH_MIN,
  clampNotebookGraphSideWidth,
  loadNotebookGraphSideCollapsed,
  loadNotebookGraphSideWidth,
  persistNotebookGraphSideCollapsed,
  persistNotebookGraphSideWidth
} from '../notebook-graph-side.util'

describe('notebook-graph-side.util', () => {
  it('should clamp the side width into the allowed range', () => {
    expect(clampNotebookGraphSideWidth(100)).toBe(260)
    expect(clampNotebookGraphSideWidth(900)).toBe(520)
    expect(clampNotebookGraphSideWidth(320)).toBe(320)
  })

  it('should clamp empty numeric storage and use the default for invalid text', () => {
    expect(loadNotebookGraphSideWidth(() => null)).toBe(NOTEBOOK_GRAPH_SIDE_WIDTH_MIN)
    expect(loadNotebookGraphSideWidth(() => 'nope')).toBe(NOTEBOOK_GRAPH_SIDE_WIDTH_DEFAULT)
    expect(loadNotebookGraphSideWidth(() => '400')).toBe(400)
  })

  it('should treat stored 1 as collapsed and persist the flag', () => {
    expect(loadNotebookGraphSideCollapsed(() => '1')).toBe(true)
    expect(loadNotebookGraphSideCollapsed(() => '0')).toBe(false)
    let stored = ''
    persistNotebookGraphSideCollapsed(true, (value) => {
      stored = value
    })
    expect(stored).toBe('1')
    persistNotebookGraphSideWidth(333, (value) => {
      stored = value
    })
    expect(stored).toBe('333')
  })
})
