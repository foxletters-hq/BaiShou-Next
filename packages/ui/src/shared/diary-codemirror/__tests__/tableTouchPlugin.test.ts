import { describe, it, expect, afterEach } from 'vitest'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'
import { setActiveTableCell } from '../table/tableActiveCell'

describe('table post-table selection', () => {
  let parent: HTMLElement | null = null

  afterEach(() => {
    parent?.remove()
    parent = null
  })

  it('redirects selection from hidden table source to post-table line', async () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)

    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\n'
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: {
        resolveAttachmentUrl: (u) => u,
        interactionMode: 'touch',
        scrollMode: 'viewport'
      }
    })

    view.dispatch({ selection: { anchor: 2, head: 2 } })
    await new Promise((r) => queueMicrotask(r))

    const gapFrom = view.state.doc.line(4).from
    expect(view.state.selection.main.head).toBeGreaterThanOrEqual(gapFrom - 1)

    view.destroy()
  })

  it('keeps all table cells as persistent contenteditable sources', () => {
    parent = document.createElement('div')
    document.body.appendChild(parent)

    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\nBelow'
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })

    const sources = view.dom.querySelectorAll('.cm-table-cell-source')
    expect(sources.length).toBe(4)

    view.dispatch({
      effects: setActiveTableCell.of({ tableFrom: 0, rowIndex: 0, colIndex: 1 })
    })

    const sourcesAfter = view.dom.querySelectorAll('.cm-table-cell-source')
    expect(sourcesAfter.length).toBe(4)

    view.destroy()
  })
})
