import { describe, expect, it } from 'vitest'
import {
  graphBareNodeIdForRevert,
  graphRevertSplitStayId,
  listRegisteredSameNameEntities,
  parseGraphNodePropsJson,
  pickBareGraphNameHit,
  readGraphNodeSuspectReason
} from '../graph-name-candidates.util'

describe('pickBareGraphNameHit', () => {
  it('should return null and not mark ambiguous when the lookup has zero rows', () => {
    expect(pickBareGraphNameHit([])).toEqual({ hit: null, ambiguous: false })
  })

  it('should return the only row and not mark ambiguous when the lookup has one row', () => {
    const only = { id: 'bare', discriminator: '' }
    expect(pickBareGraphNameHit([only])).toEqual({ hit: only, ambiguous: false })
  })

  it('should pick the bare-name row and mark ambiguous when several same-name rows exist', () => {
    const bare = { id: 'bare', discriminator: '' }
    const split = { id: 'split', discriminator: '同事' }
    expect(pickBareGraphNameHit([bare, split])).toEqual({ hit: bare, ambiguous: true })
  })
})

describe('listRegisteredSameNameEntities', () => {
  it('should list registered split entities when the current node is the bare name', () => {
    const listed = listRegisteredSameNameEntities({
      currentId: 'bare',
      currentName: '张三',
      currentDiscriminator: '',
      currentProps: {
        nameRegistry: [
          { discriminator: '同事', label: '同事', nodeId: 'split-work', registeredAt: 1 }
        ]
      }
    })
    expect(listed).toEqual([
      { nodeId: 'split-work', name: '张三', discriminator: '同事', label: '同事' }
    ])
    expect(listed[0]?.name).toBe('张三')
    expect(listed[0]?.name.includes('同事')).toBe(false)
  })

  it('should include the bare-name node when the current node is a registered split', () => {
    const listed = listRegisteredSameNameEntities({
      currentId: 'split-work',
      currentName: '张三',
      currentDiscriminator: '同事',
      currentProps: {},
      bareNode: {
        id: 'bare',
        props: {
          nameRegistry: [
            { discriminator: '同事', label: '同事', nodeId: 'split-work', registeredAt: 1 },
            { discriminator: '同学', label: '小学同学', nodeId: 'split-school', registeredAt: 2 }
          ]
        }
      }
    })
    expect(listed).toEqual([
      { nodeId: 'bare', name: '张三', discriminator: '', label: '' },
      { nodeId: 'split-school', name: '张三', discriminator: '同学', label: '小学同学' }
    ])
  })
})

describe('parseGraphNodePropsJson', () => {
  it('should return an empty object when props json is missing or invalid', () => {
    expect(parseGraphNodePropsJson(null)).toEqual({})
    expect(parseGraphNodePropsJson('{')).toEqual({})
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

describe('graphBareNodeIdForRevert', () => {
  it('should prefer the candidate without a discriminator', () => {
    expect(
      graphBareNodeIdForRevert({ id: 'split-1', discriminator: '甲' }, [
        { nodeId: 'bare', discriminator: '' },
        { nodeId: 'split-1', discriminator: '甲' }
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
