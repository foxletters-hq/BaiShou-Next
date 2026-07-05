import { describe, it, expect, afterEach } from 'vitest'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'

describe('tableEditorTouchCaret', () => {
  let parent: HTMLElement | null = null

  afterEach(() => {
    parent?.remove()
    parent = null
  })

  it('click on post-table line moves caret off document start', async () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    parent.style.height = '600px'
    document.body.appendChild(parent)

    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\nBelow table\n'
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: {
        resolveAttachmentUrl: (u) => u,
        interactionMode: 'touch',
        scrollMode: 'viewport'
      }
    })

    const belowFrom = view.state.doc.line(5).from
    view.dispatch({ selection: { anchor: 0, head: 0 } })

    const lines = parent.querySelectorAll('.cm-line')
    const belowLine = lines[lines.length - 1] as HTMLElement
    const rect = belowLine.getBoundingClientRect()
    belowLine.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        clientX: rect.left + 8,
        clientY: rect.top + 8
      })
    )

    await new Promise((r) => queueMicrotask(r))

    expect(view.state.selection.main.head).toBeGreaterThanOrEqual(belowFrom)

    view.destroy()
  })
})
