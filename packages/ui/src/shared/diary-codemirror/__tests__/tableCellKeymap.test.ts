import { describe, it, expect, afterEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { findTableCellBoundsInLine } from '../extensions/tableCell.utils'
import {
  insertTableCellLineBreak,
  tableCellExtension
} from '../extensions/tableCellKeymap'

describe('findTableCellBoundsInLine', () => {
  it('locates the cell containing the cursor', () => {
    const lineText = '| Name | Value |'
    const line = { from: 0, to: lineText.length, text: lineText, number: 1, length: lineText.length }
    const pos = lineText.indexOf('Value')
    const bounds = findTableCellBoundsInLine(line as any, pos)
    expect(bounds).toMatchObject({ from: 8, to: 15 })
  })
})

describe('tableCellKeymap', () => {
  let view: EditorView | null = null

  afterEach(() => {
    view?.destroy()
    view = null
  })

  function createView(doc: string, cursorPos: number): EditorView {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    view = new EditorView({
      parent,
      state: EditorState.create({
        doc,
        selection: { anchor: cursorPos },
        extensions: [markdown({ base: markdownLanguage }), tableCellExtension]
      })
    })
    return view
  }

  it('inserts <br> instead of splitting the table row', () => {
    const doc = '| Name | Value |\n| --- | --- |\n| foo | bar |\n'
    const cursorPos = doc.indexOf('foo') + 2
    const editorView = createView(doc, cursorPos)

    expect(insertTableCellLineBreak(editorView)).toBe(true)
    expect(editorView.state.doc.toString()).toContain('fo<br>o')
    expect(editorView.state.doc.lines).toBe(4)
  })

  it('identifies cell start for delimiter protection', () => {
    const doc = '| Name | Value |\n'
    const cursorPos = doc.indexOf('Name')
    const editorView = createView(doc, cursorPos)
    const line = editorView.state.doc.line(1)
    const bounds = findTableCellBoundsInLine(line, editorView.state.selection.main.head)
    expect(bounds?.from).toBeLessThan(cursorPos)
    expect(bounds?.to).toBeGreaterThan(cursorPos)
  })
})
