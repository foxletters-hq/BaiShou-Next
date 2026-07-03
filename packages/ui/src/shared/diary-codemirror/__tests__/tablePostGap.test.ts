import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import {
  hasTerminalBlankLine,
  resolvePostTableCursor,
  postTableSeparatorChange
} from '../table/tablePostGap'

describe('tablePostGap', () => {
  it('detects terminal blank line', () => {
    const withBlank = EditorState.create({ doc: 'hello\n\n' })
    const withoutBlank = EditorState.create({ doc: 'hello' })
    expect(hasTerminalBlankLine(withBlank.doc)).toBe(true)
    expect(hasTerminalBlankLine(withoutBlank.doc)).toBe(false)
  })

  it('inserts terminal blank when table ends the document', () => {
    const doc = '| A | B |\n| --- | --- |\n| 1 | 2 |'
    const state = EditorState.create({ doc })
    const result = resolvePostTableCursor(state.doc, doc.length)
    expect(result).toEqual({
      cursor: doc.length + 1,
      change: { from: doc.length, insert: '\n' }
    })
  })

  it('places cursor on the content line after post-table gap', () => {
    const doc = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\nNext'
    const state = EditorState.create({ doc })
    const tableTo = state.doc.line(3).to
    const contentFrom = state.doc.line(5).from
    const result = resolvePostTableCursor(state.doc, tableTo)
    expect(result).toEqual({ cursor: contentFrom })
  })

  it('places cursor on paragraph line after gap when table ends with blank gap', () => {
    const doc = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\n'
    const state = EditorState.create({ doc })
    const tableTo = state.doc.line(3).to
    const paragraphFrom = state.doc.line(5).from
    const result = resolvePostTableCursor(state.doc, tableTo)
    expect(result).toEqual({ cursor: paragraphFrom })
  })

  it('places cursor at next line start when it has content', () => {
    const doc = '| A | B |\n| --- | --- |\n| 1 | 2 |\nNext'
    const state = EditorState.create({ doc })
    const tableTo = state.doc.line(3).to
    const nextFrom = state.doc.line(4).from
    const result = resolvePostTableCursor(state.doc, tableTo)
    expect(result).toEqual({
      cursor: nextFrom + 1,
      change: { from: nextFrom, insert: '\n' }
    })
  })

  it('inserts blank gap line when content follows table without gap', () => {
    const doc = '| A | B |\n| --- | --- |\n| 1 | 2 |\nNext'
    const state = EditorState.create({ doc })
    const rowEnd = state.doc.line(3).to
    const nextFrom = state.doc.line(4).from
    const change = postTableSeparatorChange(state.doc, rowEnd)
    expect(change).toEqual({ from: nextFrom, insert: '\n' })
  })

  it('does not insert gap before fenced code block after table', () => {
    const doc = '| A | B |\n| --- | --- |\n| 1 | 2 |\n```\ntube\n```'
    const state = EditorState.create({ doc })
    const rowEnd = state.doc.line(3).to
    const change = postTableSeparatorChange(state.doc, rowEnd)
    expect(change).toBeNull()
  })
})
