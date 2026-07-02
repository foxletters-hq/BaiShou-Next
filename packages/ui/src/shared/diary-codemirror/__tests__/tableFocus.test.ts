import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { resolvePostTableCursor } from '../table/tablePostGap'

describe('resolvePostTableCursor', () => {
  it('inserts a newline when table ends the document', () => {
    const doc = '| A | B |\n| --- | --- |\n| 1 | 2 |'
    const result = resolvePostTableCursor(EditorState.create({ doc }).doc, doc.length)
    expect(result).toEqual({
      cursor: doc.length + 1,
      change: { from: doc.length, insert: '\n' }
    })
  })

  it('places cursor on the content line after gap when blank line follows the table', () => {
    const doc = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\nNext'
    const state = EditorState.create({ doc })
    const tableTo = state.doc.line(3).to
    const contentFrom = state.doc.line(5).from
    const result = resolvePostTableCursor(state.doc, tableTo)
    expect(result).toEqual({ cursor: contentFrom })
  })
})
