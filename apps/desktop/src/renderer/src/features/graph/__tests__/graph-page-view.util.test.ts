import { describe, expect, it } from 'vitest'
import {
  canApproveGraphNode,
  formatGraphRailCount,
  graphSuspectReviewCopy,
  stripGraphNodeSuspectReason,
  graphBareNodeIdForRevert,
  graphMergeSearchSeed,
  graphRevertSplitStayId,
  graphSplitInitialLabel,
  isGraphExtractDate,
  parseGraphAliasInput,
  parseGraphNodeProps,
  readGraphNodeSuspectReason,
  viewDepthFor
} from '../graph-page-view.util'

describe('viewDepthFor', () => {
  it('should map focus depth 1/2/3 onto the neighborhood request depth', () => {
    expect(viewDepthFor(1)).toBe(1)
    expect(viewDepthFor(2)).toBe(2)
    expect(viewDepthFor(3)).toBe(3)
  })
})

describe('parseGraphNodeProps', () => {
  it('should parse a valid props JSON object', () => {
    expect(parseGraphNodeProps({ propsJson: '{"a":1}' })).toEqual({ a: 1 })
  })

  it('should return an empty object when props are missing or invalid', () => {
    expect(parseGraphNodeProps(null)).toEqual({})
    expect(parseGraphNodeProps({ propsJson: null })).toEqual({})
    expect(parseGraphNodeProps({ propsJson: '{bad' })).toEqual({})
  })
})

describe('readGraphNodeSuspectReason', () => {
  it('should return a trimmed reason and ignore missing or invalid props', () => {
    expect(readGraphNodeSuspectReason({ propsJson: '{"suspectReason":"  同人异职  "}' })).toBe(
      '同人异职'
    )
    expect(readGraphNodeSuspectReason({ propsJson: '{"suspectReason":123}' })).toBe('')
    expect(readGraphNodeSuspectReason(null)).toBe('')
  })
})

describe('canApproveGraphNode', () => {
  it('should allow approve when the node is pending or still marked suspect', () => {
    expect(canApproveGraphNode({ reviewStatus: 'pending' })).toBe(true)
    expect(
      canApproveGraphNode({
        reviewStatus: 'approved',
        propsJson: '{"suspectReason":"同人异职"}'
      })
    ).toBe(true)
    expect(canApproveGraphNode({ reviewStatus: 'approved' })).toBe(false)
    expect(canApproveGraphNode(null)).toBe(false)
  })
})

describe('graphSuspectReviewCopy', () => {
  it('should use 解除怀疑 when the node still has a suspect reason', () => {
    expect(
      graphSuspectReviewCopy({ propsJson: '{"suspectReason":"同人异职"}' }).actionDefault
    ).toBe('解除怀疑')
    expect(graphSuspectReviewCopy({ reviewStatus: 'pending' }).actionDefault).toBe('通过')
  })
})

describe('stripGraphNodeSuspectReason', () => {
  it('should drop suspectReason from props json and leave other fields', () => {
    expect(
      stripGraphNodeSuspectReason({
        id: 'n1',
        propsJson: '{"aliases":["阿三"],"suspectReason":"同人异职"}'
      })
    ).toEqual({ id: 'n1', propsJson: '{"aliases":["阿三"]}' })
    expect(stripGraphNodeSuspectReason({ id: 'n2', propsJson: '{}' })).toEqual({
      id: 'n2',
      propsJson: '{}'
    })
  })
})

describe('formatGraphRailCount', () => {
  it('should keep small counts and cap large pending counts at 99+', () => {
    expect(formatGraphRailCount(0)).toBe('')
    expect(formatGraphRailCount(8)).toBe('8')
    expect(formatGraphRailCount(99)).toBe('99')
    expect(formatGraphRailCount(467)).toBe('99+')
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

describe('graphBareNodeIdForRevert', () => {
  it('should prefer the candidate without a discriminator', () => {
    expect(
      graphBareNodeIdForRevert({ id: 'split-1', discriminator: '甲' }, [
        { nodeId: 'bare', name: 'N', discriminator: '', label: '' },
        { nodeId: 'split-1', name: 'N', discriminator: '甲', label: '甲' }
      ])
    ).toBe('bare')
  })

  it('should fall back to the selected node when it is already the bare entity', () => {
    expect(graphBareNodeIdForRevert({ id: 'bare', discriminator: '' }, [])).toBe('bare')
  })

  it('should return empty when a split node has no bare sibling', () => {
    expect(graphBareNodeIdForRevert({ id: 'split-1', discriminator: '甲' }, [])).toBe('')
    expect(graphBareNodeIdForRevert(null, [])).toBe('')
  })
})

describe('graphRevertSplitStayId', () => {
  it('should jump to the bare node when the current node was removed', () => {
    expect(
      graphRevertSplitStayId({
        selectedNodeId: 'gone',
        removedNodeId: 'gone',
        bareNodeId: 'bare'
      })
    ).toBe('bare')
  })

  it('should stay on the current node when a sibling was removed', () => {
    expect(
      graphRevertSplitStayId({
        selectedNodeId: 'keep',
        removedNodeId: 'gone',
        bareNodeId: 'bare'
      })
    ).toBe('keep')
  })
})

describe('graphSplitInitialLabel', () => {
  it('should use the sibling label when the selected node has a discriminator', () => {
    expect(
      graphSplitInitialLabel({ id: 'n1', discriminator: '甲' }, [
        { nodeId: 'n1', name: 'N', discriminator: '甲', label: '学校的甲' }
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

  it('should skip source anchors when they are forbidden', () => {
    expect(
      graphMergeSearchSeed({
        selectedId: 's1',
        selectedNode: { id: 's1', name: '资料', nodeType: 'source' },
        findNode: () => null,
        forbiddenNodeTypes: ['source']
      })
    ).toBeNull()
  })
})
