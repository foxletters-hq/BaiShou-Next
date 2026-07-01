import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import {
  addTableColumnMarkdown,
  addTableRowMarkdown,
  deleteTableColumnMarkdown,
  deleteTableRowMarkdown,
  moveTableColumnMarkdown,
  moveTableRowMarkdown,
  updateTableCellMarkdown
} from '../table/table.ops'
import { parseTableFromDoc } from '../table/table.model'

const SAMPLE = '| A | B |\n| --- | --- |\n| 1 | 2 |\n'

function parseSample() {
  const state = EditorState.create({ doc: SAMPLE })
  const lastLine = state.doc.line(state.doc.lines)
  return parseTableFromDoc(state.doc, 0, lastLine.to)!
}

describe('table.ops', () => {
  it('adds a column', () => {
    const table = parseSample()
    expect(addTableColumnMarkdown(table)).toBe('| A | B |  |\n| --- | --- | --- |\n| 1 | 2 |  |')
  })

  it('adds a row', () => {
    const table = parseSample()
    expect(addTableRowMarkdown(table)).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |\n|  |  |')
  })

  it('deletes a column', () => {
    const table = parseSample()
    expect(deleteTableColumnMarkdown(table, 1)).toBe('| A |\n| --- |\n| 1 |')
  })

  it('deletes a row', () => {
    const table = parseSample()
    expect(deleteTableRowMarkdown(table, 0)).toBe('| A | B |\n| --- | --- |')
  })

  it('moves columns and rows', () => {
    const table = parseSample()
    expect(moveTableColumnMarkdown(table, 0, 1)).toBe('| B | A |\n| --- | --- |\n| 2 | 1 |')
    expect(moveTableRowMarkdown(table, 0, 0)).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |')
  })

  it('updates a cell value', () => {
    const table = parseSample()
    expect(updateTableCellMarkdown(table, 0, 1, '9')).toBe('| A | B |\n| --- | --- |\n| 1 | 9 |')
    expect(updateTableCellMarkdown(table, -1, 0, 'Header')).toBe(
      '| Header | B |\n| --- | --- |\n| 1 | 2 |'
    )
  })
})
