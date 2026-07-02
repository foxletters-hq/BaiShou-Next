import { describe, it, expect, afterEach } from 'vitest'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'

describe('tableTouchPlugin', () => {
  let parent: HTMLElement | null = null

  afterEach(() => {
    parent?.remove()
    parent = null
  })

  it('places cursor on paragraph line after table when tapping in padding below the block', async () => {
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

    const gapFrom = view.state.doc.line(4).from
    view.dispatch({ selection: { anchor: gapFrom } })
    await new Promise((r) => queueMicrotask(r))
    expect(view.state.selection.main.head).toBeGreaterThan(gapFrom)

    view.destroy()
  })

  it('places cursor after table when tap maps to hidden table source', async () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)

    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\n'
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })

    view.dispatch({ selection: { anchor: 2, head: 2 } })
    await new Promise((resolve) => queueMicrotask(resolve))

    const gapFrom = view.state.doc.line(4).from
    expect(view.state.selection.main.head).toBeGreaterThanOrEqual(gapFrom - 1)
    expect(view.state.doc.toString()).toBe(content)

    view.destroy()
  })
})
