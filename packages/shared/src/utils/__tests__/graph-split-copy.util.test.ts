import { describe, expect, it } from 'vitest'
import {
  GRAPH_SPLIT_EDGE_PAGE_SIZE,
  formatGraphSplitPartnerName,
  graphSplitEdgePageCount,
  graphSplitNewDisplayName,
  shouldCloseGraphSplitAfterSave,
  sliceGraphSplitEdges
} from '../graph-split-copy.util'

describe('graphSplitNewDisplayName', () => {
  it('should prefer the typed label when present', () => {
    expect(
      graphSplitNewDisplayName({ nodeName: '张三', discriminator: '同事', label: '三哥' })
    ).toBe('三哥')
  })

  it('should combine name and discriminator when label is empty', () => {
    expect(
      graphSplitNewDisplayName({ nodeName: '张三', discriminator: '同事', label: '  ' })
    ).toBe('张三（同事）')
  })
})

describe('sliceGraphSplitEdges', () => {
  it('should return one page of edges when the list is longer than the page size', () => {
    const edges = Array.from({ length: 45 }, (_, i) => i)
    expect(sliceGraphSplitEdges(edges, 2)).toEqual(
      Array.from({ length: GRAPH_SPLIT_EDGE_PAGE_SIZE }, (_, i) => i + GRAPH_SPLIT_EDGE_PAGE_SIZE)
    )
    expect(graphSplitEdgePageCount(45)).toBe(3)
  })
})

describe('shouldCloseGraphSplitAfterSave', () => {
  it('should close when the new entity exists even if leftover relations remain', () => {
    expect(
      shouldCloseGraphSplitAfterSave({
        splitNodeId: 'split-1'
      })
    ).toBe(true)
  })

  it('should stay open when the save did not produce a new entity', () => {
    expect(shouldCloseGraphSplitAfterSave({ splitNodeId: '' })).toBe(false)
  })
})

describe('formatGraphSplitPartnerName', () => {
  it('should show only the date when the partner name is a date path', () => {
    expect(formatGraphSplitPartnerName('/2024-10-20')).toBe('2024-10-20')
  })

  it('should keep a normal person name', () => {
    expect(formatGraphSplitPartnerName('李四')).toBe('李四')
  })
})
