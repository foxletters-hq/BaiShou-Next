import { describe, expect, it } from 'vitest'
import {
  graphSameNameExistingFromRow,
  isGraphNodeSameNameConflict,
  pickSameNameConflictFromHits
} from '../graph-same-name.util'

describe('graph-same-name.util', () => {
  it('ignores the node being edited', () => {
    expect(
      graphSameNameExistingFromRow(
        { id: 'n1', name: '张三', nodeType: 'person', summary: '' },
        'n1'
      )
    ).toBeNull()
  })

  it('returns another live node with the same name', () => {
    expect(
      graphSameNameExistingFromRow(
        { id: 'n2', name: '张三', nodeType: 'person', summary: '同事' },
        'n1'
      )
    ).toEqual({
      id: 'n2',
      name: '张三',
      nodeType: 'person',
      summary: '同事'
    })
  })

  it('should ignore a split sibling when the discriminator still matches the current node', () => {
    expect(
      pickSameNameConflictFromHits(
        [
          { id: 'bare', name: '张三', nodeType: 'person', discriminator: '', summary: '' },
          { id: 'split', name: '张三', nodeType: 'person', discriminator: '同事', summary: '' }
        ],
        'split',
        '同事'
      )
    ).toBeNull()
  })

  it('should treat another bare-name row as a conflict when creating a new bare node', () => {
    expect(
      pickSameNameConflictFromHits(
        [{ id: 'bare', name: '张三', nodeType: 'person', discriminator: '', summary: '父亲' }],
        undefined,
        ''
      )
    ).toEqual({
      id: 'bare',
      name: '张三',
      nodeType: 'person',
      summary: '父亲'
    })
  })

  it('detects a same-name write conflict', () => {
    expect(isGraphNodeSameNameConflict({ id: 'n1' })).toBe(false)
    expect(
      isGraphNodeSameNameConflict({
        conflict: 'same-name',
        existing: { id: 'n2', name: '张三', nodeType: 'person', summary: '' }
      })
    ).toBe(true)
  })
})
