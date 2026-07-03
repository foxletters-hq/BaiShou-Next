import { describe, it, expect, afterEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'
import { buildTablePreviewDecorations, changeAffectsTables } from '../extensions/tablePreviewField'
import { diarySyntaxTreeGrowthEffect } from '../extensions/diarySyntaxTreeGrowth'
import { setActiveTableCell } from '../table/tableActiveCell'
import { dispatchTableModelFromBlock } from '../table/tableDom'

describe('tablePreviewField', () => {
  let parent: HTMLElement | null = null
  let view: EditorView | null = null

  afterEach(() => {
    view?.destroy()
    parent?.remove()
    view = null
    parent = null
  })

  function createTableView(content: string): EditorView {
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)
    view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })
    return view
  }

  it('round-trip: opening doc without edits preserves markdown', () => {
    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\nBelow\n'
    const editorView = createTableView(content)
    expect(editorView.state.doc.toString()).toBe(content)
    expect(parent!.querySelector('.cm-table-block')).toBeTruthy()
  })

  it('buildTablePreviewDecorations uses line-boundary replace range', () => {
    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n'
    const editorView = createTableView(content)
    const deco = buildTablePreviewDecorations(editorView.state)
    let replaceFrom = -1
    let replaceTo = -1
    const iter = deco.iter()
    while (iter.value) {
      const spec = iter.value.spec as { widget?: unknown }
      if (spec.widget) {
        replaceFrom = iter.from
        replaceTo = iter.to
        break
      }
      iter.next()
    }
    expect(replaceFrom).toBe(0)
    expect(replaceTo).toBe(editorView.state.doc.line(3).to)
  })

  it('rebuilds on setActiveTableCell effect', () => {
    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n'
    const editorView = createTableView(content)
    editorView.dispatch({
      effects: setActiveTableCell.of({ tableFrom: 0, rowIndex: 0, colIndex: 1 })
    })
    expect(parent!.querySelector('.cm-table-block--has-active-cell')).toBeTruthy()
  })

  it('rebuilds on diarySyntaxTreeGrowthEffect', () => {
    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n'
    const editorView = createTableView(content)
    editorView.dispatch({ effects: diarySyntaxTreeGrowthEffect.of(null) })
    expect(parent!.querySelector('.cm-table-block')).toBeTruthy()
  })

  it('changeAffectsTables is false for edits outside pipe lines', () => {
    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\nBelow text\n'
    const editorView = createTableView(content)
    const decoBefore = buildTablePreviewDecorations(editorView.state)
    const belowFrom = editorView.state.doc.line(5).from
    const tr = editorView.state.update({
      changes: { from: belowFrom, insert: 'X' }
    })
    expect(changeAffectsTables(tr, decoBefore)).toBe(false)
  })

  it('changeAffectsTables is true when edit overlaps table decoration', () => {
    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n'
    const state = EditorState.create({
      doc: content,
      extensions: [markdown({ base: markdownLanguage })]
    })
    const deco = buildTablePreviewDecorations(state)
    const tr = state.update({ changes: { from: 2, to: 3, insert: 'X' } })
    expect(changeAffectsTables(tr, deco)).toBe(true)
  })

  it('cell edit updates doc markdown via dispatchTableModelFromBlock', () => {
    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n'
    const editorView = createTableView(content)
    const block = parent!.querySelector('.cm-table-block') as HTMLElement
    const cell = block.querySelector(
      'tbody td .cm-table-cell-source[data-row="0"][data-col="0"]'
    ) as HTMLElement
    expect(cell).toBeTruthy()
    cell.textContent = '9'
    cell.dataset.raw = '9'
    expect(dispatchTableModelFromBlock(editorView, block)).toBe(true)
    expect(editorView.state.doc.toString()).toContain('| 9 | 2 |')
  })

  it('typing in active cell keeps table widget DOM until blur commits', async () => {
    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n'
    const editorView = createTableView(content)
    editorView.dispatch({
      effects: setActiveTableCell.of({ tableFrom: 0, rowIndex: 0, colIndex: 0 })
    })
    await Promise.resolve()
    const block = parent!.querySelector('.cm-table-block') as HTMLElement
    const cell = block.querySelector(
      'tbody td .cm-table-cell-source[data-row="0"][data-col="0"]'
    ) as HTMLElement
    cell.textContent = '12'
    cell.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
    await Promise.resolve()
    expect(parent!.querySelector('.cm-table-block')).toBe(block)
    expect(editorView.state.doc.toString()).toContain('| 1 | 2 |')
    cell.dispatchEvent(new FocusEvent('blur', { bubbles: false }))
    await Promise.resolve()
    expect(editorView.state.doc.toString()).toContain('| 12 | 2 |')
  })

  it('typing after table stays outside pipe rows', async () => {
    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\nBelow\n'
    const editorView = createTableView(content)
    const belowFrom = editorView.state.doc.line(5).from
    editorView.dispatch({
      changes: { from: belowFrom, to: belowFrom, insert: 'Hello' },
      selection: { anchor: belowFrom + 5 }
    })
    await new Promise((r) => queueMicrotask(r))
    const doc = editorView.state.doc.toString()
    expect(doc).toMatch(/\| 1 \| 2 \|\n\nHello/)
    expect(doc).toContain('Below')
  })
})
