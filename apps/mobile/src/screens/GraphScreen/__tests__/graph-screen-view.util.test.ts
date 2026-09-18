import { describe, expect, it } from 'vitest'
import {
  graphMergeSearchSeed,
  graphSplitInitialLabel,
  isGraphExtractDate,
  parseGraphAliasInput,
  viewDepthFor
} from '../graph-screen-view.util'

describe('viewDepthFor', () => {
  it('should map focus depth 1/2/3 onto the neighborhood request depth', () => {
    expect(viewDepthFor(1)).toBe(1)
    expect(viewDepthFor(2)).toBe(2)
    expect(viewDepthFor(3)).toBe(3)
  })
})

describe('isGraphExtractDate', () => {
  it('should accept only a full YYYY-MM-DD date', () => {
    expect(isGraphExtractDate('2024-01-02')).toBe(true)
    expect(isGraphExtractDate('2024-1-2')).toBe(false)
    expect(isGraphExtractDate('')).toBe(false)
  })
})

describe('parseGraphAliasInput', () => {
  it('should split aliases on comma variants and drop blanks', () => {
    expect(parseGraphAliasInput('甲, 乙，丙、 丁 , ')).toEqual(['甲', '乙', '丙', '丁'])
  })
})

describe('graphSplitInitialLabel', () => {
  it('should use the sibling label when the selected node has a discriminator', () => {
    expect(
      graphSplitInitialLabel({ id: 'n1', discriminator: '甲' }, [
        { nodeId: 'n1', label: '学校的甲' }
      ])
    ).toBe('学校的甲')
  })

  it('should fall back to the discriminator and stay empty for a bare node', () => {
    expect(graphSplitInitialLabel({ id: 'n1', discriminator: '甲' }, [])).toBe('甲')
    expect(graphSplitInitialLabel({ id: 'n1' }, [])).toBe('')
  })
})

describe('graphMergeSearchSeed', () => {
  it('should prefer the selected node snapshot and skip diary entries', () => {
    expect(
      graphMergeSearchSeed({
        selectedId: 'p1',
        selectedNode: { id: 'p1', name: '李', nodeType: 'person' },
        findNode: () => ({ id: 'other', name: 'X', nodeType: 'person' })
      })
    ).toEqual({ id: 'p1', name: '李', nodeType: 'person' })
    expect(
      graphMergeSearchSeed({
        selectedId: 'e1',
        selectedNode: { id: 'e1', name: '日记', nodeType: 'entry' },
        findNode: () => null
      })
    ).toBeNull()
  })

  it('should look up the node when the snapshot is stale and return null without a selection', () => {
    expect(
      graphMergeSearchSeed({
        selectedId: 'p2',
        selectedNode: { id: 'old', name: '旧', nodeType: 'person' },
        findNode: (id) => (id === 'p2' ? { id: 'p2', name: '王', nodeType: 'place' } : null)
      })
    ).toEqual({ id: 'p2', name: '王', nodeType: 'place' })
    expect(
      graphMergeSearchSeed({
        selectedId: null,
        selectedNode: null,
        findNode: () => ({ id: 'x', name: 'X', nodeType: 'person' })
      })
    ).toBeNull()
  })
})
