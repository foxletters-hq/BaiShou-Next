import { describe, it, expect, afterEach } from 'vitest'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'
import { findTableRangeAt } from '../table/tableBounds'
import { ensureSyntaxTree } from '@codemirror/language'
import { placeEditorCaretFromPointer } from '../table/tableEditorTouchCaret'

describe('table head=0 redirect', () => {
  let parent: HTMLElement | null = null

  afterEach(() => {
    parent?.remove()
    parent = null
  })

  const content = '| a | b |\n| --- | --- |\n| 1 | 2 |\n\nsjsj\nndjdk\n'

  it('findTableRangeAt matches head=0 inside table-at-doc-start', () => {
    parent = document.createElement('div')
    document.body.appendChild(parent)
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch', scrollMode: 'viewport' }
    })
    ensureSyntaxTree(view.state, view.state.doc.length, 200)
    const range = findTableRangeAt(view.state, 0)
    expect(range).toBeTruthy()
    expect(range!.from).toBe(0)
    view.destroy()
  })

  it('keepSelectionOutsideTables redirects head=0 to post-table body', async () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    parent.style.height = '600px'
    document.body.appendChild(parent)
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch', scrollMode: 'viewport' }
    })
    const tableTo = view.state.doc.line(3).to
    view.dispatch({ selection: { anchor: 0, head: 0 } })
    await new Promise((r) => queueMicrotask(r))
    await new Promise((r) => queueMicrotask(r))
    expect(view.state.selection.main.head).toBeGreaterThan(tableTo)
    view.destroy()
  })

  it('keepSelectionOutsideTables redirects head=0 even when table cell is focused', async () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    parent.style.height = '600px'
    document.body.appendChild(parent)
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch', scrollMode: 'viewport' }
    })
    const cell = parent.querySelector('.cm-table-cell-source') as HTMLElement
    expect(cell).toBeTruthy()
    cell.focus()
    const tableTo = view.state.doc.line(3).to
    view.dispatch({ selection: { anchor: 0, head: 0 } })
    await new Promise((r) => queueMicrotask(r))
    await new Promise((r) => queueMicrotask(r))
    expect(view.state.selection.main.head).toBeGreaterThan(tableTo)
    view.destroy()
  })

  it('placeEditorCaretFromPointer falls back to line DOM when coords miss', () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    parent.style.height = '600px'
    document.body.appendChild(parent)
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch', scrollMode: 'viewport' }
    })
    const lines = parent.querySelectorAll('.cm-line')
    const belowLine = lines[lines.length - 2] as HTMLElement
    expect(belowLine).toBeTruthy()
    const belowFrom = view.state.doc.line(5).from
    view.dispatch({ selection: { anchor: 0, head: 0 } })
    const ok = placeEditorCaretFromPointer(view, 0, 0, 'test', belowLine)
    expect(ok).toBe(true)
    expect(view.state.selection.main.head).toBeGreaterThanOrEqual(belowFrom - 2)
    view.destroy()
  })

  it('redirects selection on structural gap line to post-table body', async () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    parent.style.height = '600px'
    document.body.appendChild(parent)
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch', scrollMode: 'viewport' }
    })
    const gapFrom = view.state.doc.line(4).from
    const bodyFrom = view.state.doc.line(5).from
    view.dispatch({ selection: { anchor: gapFrom, head: gapFrom } })
    await new Promise((r) => queueMicrotask(r))
    await new Promise((r) => queueMicrotask(r))
    expect(view.state.selection.main.head).toBeGreaterThanOrEqual(bodyFrom - 1)
    view.destroy()
  })

  it('placeEditorCaretFromPointer redirects stuck head when all coords miss', () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    parent.style.height = '600px'
    document.body.appendChild(parent)
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch', scrollMode: 'viewport' }
    })
    const tableTo = view.state.doc.line(3).to
    view.dispatch({ selection: { anchor: 0, head: 0 } })
    const ok = placeEditorCaretFromPointer(view, -1, -1, 'test')
    expect(ok).toBe(true)
    expect(view.state.selection.main.head).toBeGreaterThan(tableTo)
    view.destroy()
  })
})
