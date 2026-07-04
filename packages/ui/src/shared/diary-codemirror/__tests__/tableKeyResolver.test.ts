import { describe, it, expect } from 'vitest'
import { parseTableFromDoc } from '../table/table.model'
import { resolveTableKeyAction } from '../table/tableKeyResolver'
import { EditorState } from '@codemirror/state'

function parseSampleTable() {
  const doc = '| A | B |\n| --- | --- |\n| 1 | 2 |'
  const state = EditorState.create({ doc })
  return parseTableFromDoc(state.doc, 0, doc.length)!
}

describe('resolveTableKeyAction', () => {
  it('moves to the next cell on tab', () => {
    const table = parseSampleTable()
    expect(resolveTableKeyAction(table, -1, 0, 'tab')).toEqual({
      kind: 'focus-cell',
      rowIndex: -1,
      colIndex: 1
    })
  })

  it('inserts a row when tab leaves the last cell', () => {
    const table = parseSampleTable()
    expect(resolveTableKeyAction(table, 0, 1, 'tab')).toEqual({
      kind: 'insert-row-below',
      afterRowIndex: 0
    })
  })

  it('inserts a row when enter leaves the last cell in a row', () => {
    const table = parseSampleTable()
    expect(resolveTableKeyAction(table, 0, 1, 'enter')).toEqual({
      kind: 'insert-row-below',
      afterRowIndex: 0
    })
  })

  it('exits the table on escape', () => {
    const table = parseSampleTable()
    expect(resolveTableKeyAction(table, 0, 0, 'escape')).toEqual({ kind: 'exit-after' })
  })
})
