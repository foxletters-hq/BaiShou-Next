import { describe, it, expect, afterEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { isTableSeparatorLine } from '../extensions/buildTable'
import { buildMarkerHidingDecorations } from '../extensions/build'
import { countTableColumns } from '../extensions/tableCell.utils'

describe('isTableSeparatorLine', () => {
  it('matches common GFM separator rows', () => {
    expect(isTableSeparatorLine('| --- | --- |')).toBe(true)
    expect(isTableSeparatorLine('|---|---|')).toBe(true)
    expect(isTableSeparatorLine('| :--- | ---: |')).toBe(true)
  })

  it('rejects normal table data rows', () => {
    expect(isTableSeparatorLine('| cell a | cell b |')).toBe(false)
    expect(isTableSeparatorLine('| Header 1 | Header 2 |')).toBe(false)
  })
})

describe('countTableColumns', () => {
  it('counts columns from header row', () => {
    expect(countTableColumns('| A | B | C |')).toBe(3)
    expect(countTableColumns('| A | B |')).toBe(2)
    expect(countTableColumns('no table')).toBe(1)
  })
})

describe('buildMarkerHidingDecorations table preview', () => {
  let view: EditorView | null = null

  afterEach(() => {
    view?.destroy()
    view = null
  })

  function createView(doc: string, cursorPos = 0): EditorView {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    view = new EditorView({
      parent,
      state: EditorState.create({
        doc,
        selection: { anchor: cursorPos },
        extensions: [markdown({ base: markdownLanguage })]
      })
    })
    return view
  }

  it('builds decorations for table with inline marks when cursor is outside', () => {
    const doc = '| **Name** | Value |\n| --- | --- |\n| foo | bar |\n\nTail'
    const editorView = createView(doc, doc.length)
    expect(() => buildMarkerHidingDecorations(editorView.state)).not.toThrow()
  })

  it('shows table block widget when cursor is outside the table', () => {
    const doc = '| Name | Value |\n| --- | --- |\n| foo | bar |\n'
    const editorView = createView(doc, doc.length)
    const deco = buildMarkerHidingDecorations(editorView.state)

    let hasTableBlockWidget = false
    const iter = deco.iter()
    while (iter.value) {
      const spec = iter.value.spec as { widget?: { constructor?: { name?: string } } }
      if (spec.widget?.constructor?.name === 'TableBlockWidget') {
        hasTableBlockWidget = true
        break
      }
      iter.next()
    }

    expect(hasTableBlockWidget).toBe(true)
  })

  it('always shows table block widget even when cursor is inside table source', () => {
    const doc = '| Name | Value |\n| --- | --- |\n| foo | bar |\n'
    const cursorPos = doc.indexOf('foo')
    const editorView = createView(doc, cursorPos)
    const deco = buildMarkerHidingDecorations(editorView.state)

    let hasTableBlockWidget = false
    const iter = deco.iter()
    while (iter.value) {
      const spec = iter.value.spec as { widget?: { constructor?: { name?: string } } }
      if (spec.widget?.constructor?.name === 'TableBlockWidget') {
        hasTableBlockWidget = true
        break
      }
      iter.next()
    }

    expect(hasTableBlockWidget).toBe(true)
  })

  it('shows raw table syntax on the active line', () => {
    const doc = '| Name | Value |\n| --- | --- |\n| foo | bar |\n'
    const cursorPos = doc.indexOf('foo')
    const editorView = createView(doc, cursorPos)
    const deco = buildMarkerHidingDecorations(editorView.state)

    let hidesDelimiterOnActiveRow = false
    const iter = deco.iter(doc.indexOf('| foo'))
    while (iter.value) {
      const spec = iter.value.spec as { side?: number }
      if (iter.from === doc.indexOf('| foo') && iter.to === doc.indexOf('| foo') + 1) {
        if (spec.side === undefined) hidesDelimiterOnActiveRow = true
      }
      iter.next()
    }

    expect(hidesDelimiterOnActiveRow).toBe(false)
  })
})
