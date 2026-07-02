import { describe, it, expect, afterEach } from 'vitest'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'

describe('post-table typing', () => {
  let parent: HTMLElement | null = null
  afterEach(() => {
    parent?.remove()
    parent = null
  })

  async function flush() {
    await new Promise((r) => queueMicrotask(r))
    await new Promise((r) => requestAnimationFrame(r))
  }

  it('typing on gap line keeps text out of table syntax', async () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)
    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\nNext\nMore'
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })
    const gapFrom = view.state.doc.line(4).from
    view.dispatch({ selection: { anchor: gapFrom, head: gapFrom } })
    await flush()
    view.dispatch({ changes: { from: gapFrom, to: gapFrom, insert: 'Hello' } })
    await flush()
    const doc = view.state.doc.toString()
    expect(doc).toMatch(/\| 1 \| 2 \|\n\nHello/)
    expect(doc).toContain('Next')
    view.destroy()
  })

  it('typing on first line after table without blank gap keeps content below', async () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)
    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\nNext paragraph\nMore below'
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })
    const lineFrom = view.state.doc.line(4).from
    view.dispatch({ selection: { anchor: lineFrom, head: lineFrom } })
    await flush()
    view.dispatch({ changes: { from: lineFrom, to: lineFrom, insert: 'X' } })
    await flush()
    const doc = view.state.doc.toString()
    expect(doc).toContain('More below')
    view.destroy()
  })

  it('typing on gap line does not reset selection to table top', async () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)
    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\nNext\nMore'
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })
    const gapFrom = view.state.doc.line(4).from
    view.dispatch({ selection: { anchor: gapFrom, head: gapFrom } })
    await flush()
    view.dispatch({ changes: { from: gapFrom, to: gapFrom, insert: 'a' } })
    await flush()
    const doc = view.state.doc.toString()
    expect(doc).toContain('a')
    expect(doc).toContain('Next')
    expect(doc).toContain('More')
    view.destroy()
  })
})
