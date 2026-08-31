import { describe, expect, it } from 'vitest'
import {
  graphSameNameExistingFromRow,
  isGraphNodeSameNameConflict
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
