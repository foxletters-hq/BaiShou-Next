import { describe, it, expect } from 'vitest'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'
import { placeCursorAfterTable } from '../table/tableFocus'
import { findTableToByFrom } from '../table/tableBounds'

describe('selectionBoundsTransactionFilter', () => {
  it('clamps explicit out-of-range selection without throwing', () => {
    const parent = document.createElement('div')
    document.body.appendChild(parent)

    const view = createDiaryCodeMirror(parent, {
      content: 'hello',
      platform: { resolveAttachmentUrl: (s) => s, interactionMode: 'mouse' }
    })

    expect(() => {
      view.dispatch({ selection: { anchor: 99, head: 99 } })
    }).not.toThrow()

    expect(view.state.selection.main.head).toBe(5)

    view.destroy()
    parent.remove()
  })

  it('clamps selection when replacing with shorter content', () => {
    const parent = document.createElement('div')
    document.body.appendChild(parent)

    const view = createDiaryCodeMirror(parent, {
      content: 'hello world',
      platform: { resolveAttachmentUrl: (s) => s, interactionMode: 'mouse' }
    })

    expect(() => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: 'hi' },
        selection: { anchor: 11, head: 11 }
      })
    }).not.toThrow()

    expect(view.state.doc.toString()).toBe('hi')
    expect(view.state.selection.main.head).toBe(2)

    view.destroy()
    parent.remove()
  })

  it('does not break placeCursorAfterTable on touch stack', () => {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |'

    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })
    const tableTo = view.state.doc.line(3).to

    expect(() => placeCursorAfterTable(view, tableTo)).not.toThrow()
    expect(view.state.doc.length).toBeGreaterThan(content.length)
    expect(view.state.selection.main.head).toBe(view.state.doc.length)

    view.destroy()
    parent.remove()
  })

  it('placeCursorAfterTable extends document when table ends at EOF', () => {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const prefix = 'intro\n\n'
    const table = '| A | B |\n| --- | --- |\n| 1 | 2 |'
    const content = `${prefix}${table}`

    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })
    const tableFrom = prefix.length
    const tableTo = findTableToByFrom(view.state, tableFrom)
    expect(tableTo).not.toBeNull()

    placeCursorAfterTable(view, tableTo!)
    expect(view.state.doc.length).toBeGreaterThan(content.length)
    expect(view.state.selection.main.head).toBe(view.state.doc.length)

    view.destroy()
    parent.remove()
  })
})
