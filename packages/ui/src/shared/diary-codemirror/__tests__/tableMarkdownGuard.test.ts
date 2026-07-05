import { describe, it, expect, afterEach } from 'vitest'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'

describe('table markdown keyboard guard', () => {
  let parent: HTMLElement | null = null

  afterEach(() => {
    parent?.remove()
    parent = null
  })

  it('blocks backspace on hidden table body rows on touch', async () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)
    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\nBelow'
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })

    const bodyLineFrom = view.state.doc.line(3).from + 2
    view.dispatch({ selection: { anchor: bodyLineFrom, head: bodyLineFrom } })
    await new Promise((r) => queueMicrotask(r))

    const before = view.state.doc.toString()
    view.dispatch({
      changes: { from: bodyLineFrom, to: bodyLineFrom + 1, insert: '' }
    })
    expect(view.state.doc.toString()).toBe(before)
    expect(view.state.doc.toString()).toContain('| 1 | 2 |')
    view.destroy()
  })
})
