import { describe, it, expect, afterEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { isTableStructureChangeAllowed } from '../extensions/tableStructureFilter'
import { tableCellExtension } from '../extensions/tableCellKeymap'

describe('tableStructureProtectFilter', () => {
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

  function dispatchAndGetDoc(editorView: EditorView, changes: { from: number; to: number; insert?: string }) {
    const before = editorView.state.doc.toString()
    editorView.dispatch({
      changes: { from: changes.from, to: changes.to, insert: changes.insert ?? '' }
    })
    return { before, after: editorView.state.doc.toString() }
  }

  it('blocks deleting a pipe character', () => {
    const doc = '| Name | Value |\n'
    const pipePos = doc.indexOf('|')
    const editorView = createView(doc, pipePos + 1)
    const { before, after } = dispatchAndGetDoc(editorView, {
      from: pipePos,
      to: pipePos + 1,
      insert: ''
    })
    expect(after).toBe(before)
  })

  it('blocks deleting a pipe inside a selection', () => {
    const doc = '| Name | Value |\n'
    const editorView = createView(doc, 2)
    const from = doc.indexOf('|')
    const to = doc.indexOf('Name') + 2
    editorView.dispatch({ selection: { anchor: from, head: to } })
    const before = editorView.state.doc.toString()
    editorView.dispatch({ changes: { from, to, insert: '' } })
    expect(editorView.state.doc.toString()).toBe(before)
  })

  it('blocks merging two table rows with backspace', () => {
    const doc = '| a | b |\n| c | d |\n'
    const secondRowStart = doc.indexOf('| c')
    const editorView = createView(doc, secondRowStart)
    const { before, after } = dispatchAndGetDoc(editorView, {
      from: secondRowStart - 1,
      to: secondRowStart,
      insert: ''
    })
    expect(after).toBe(before)
  })

  it('allows deleting an entire table row', () => {
    const doc = '| a | b |\n| c | d |\n\n'
    const line = doc.indexOf('| c')
    const lineEnd = doc.indexOf('\n', line)
    const editorView = createView(doc, line)
    editorView.dispatch({
      changes: { from: line, to: lineEnd + 1, insert: '' }
    })
    expect(editorView.state.doc.toString()).toBe('| a | b |\n\n')
  })

  it('allows inserting <br> inside a cell', () => {
    const doc = '| a | b |\n'
    const pos = doc.indexOf('a') + 1
    const editorView = createView(doc, pos)
    editorView.dispatch({ changes: { from: pos, to: pos, insert: '<br>' } })
    expect(editorView.state.doc.toString()).toContain('a<br>')
  })

  it('blocks newline insertion inside a table row', () => {
    const doc = '| a | b |\n'
    const pos = doc.indexOf('a') + 1
    const editorView = createView(doc, pos)
    const before = editorView.state.doc.toString()
    editorView.dispatch({ changes: { from: pos, to: pos, insert: '\n' } })
    expect(editorView.state.doc.toString()).toBe(before)
  })

  it('isTableStructureChangeAllowed rejects mid-row newline', () => {
    const state = EditorState.create({ doc: '| a | b |\n' })
    const pos = state.doc.toString().indexOf('a') + 1
    const tr = state.update({ changes: { from: pos, to: pos, insert: '\n' } })
    expect(isTableStructureChangeAllowed(tr)).toBe(false)
  })

  it('reports blocked transactions via isTableStructureChangeAllowed', () => {
    const state = EditorState.create({ doc: '| a | b |\n' })
    const pipePos = 0
    const tr = state.update({
      changes: { from: pipePos, to: pipePos + 1, insert: '' }
    })
    expect(isTableStructureChangeAllowed(tr)).toBe(false)
  })
})
