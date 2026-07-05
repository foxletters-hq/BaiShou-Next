import { describe, it, expect, afterEach } from 'vitest'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'
import { clampPosToDoc } from '../editorContentSync'
import { placeCursorAfterTable } from '../table/tableFocus'

describe('desktop diary mount selection', () => {
  let parent: HTMLElement | null = null

  afterEach(() => {
    parent?.remove()
    parent = null
  })

  async function simulateDesktopMount(content: string) {
    parent = document.createElement('div')
    parent.style.width = '640px'
    parent.style.height = '480px'
    document.body.appendChild(parent)

    const view = createDiaryCodeMirror(parent, {
      content,
      platform: {
        resolveAttachmentUrl: (u) => u,
        interactionMode: 'mouse',
        tagLineMode: true
      }
    })

    const docLength = view.state.doc.length
    view.dispatch({
      selection: {
        anchor: clampPosToDoc(docLength, docLength),
        head: clampPosToDoc(docLength, docLength)
      }
    })
    view.focus()

    await new Promise((r) => queueMicrotask(r))
    await new Promise((r) => queueMicrotask(r))
    await new Promise((r) => requestAnimationFrame(r))

    return view
  }

  it('plain diary text does not throw on mount', async () => {
    const view = await simulateDesktopMount('#旅行\n\n今天天气不错，写点日记。')
    expect(view.state.selection.main.head).toBeLessThanOrEqual(view.state.doc.length)
    view.destroy()
  })

  it('table at document end does not throw on mount', async () => {
    const content = '#记录\n\n| A | B |\n| --- | --- |\n| 1 | 2 |'
    const view = await simulateDesktopMount(content)
    expect(view.state.selection.main.head).toBeLessThanOrEqual(view.state.doc.length)
    view.destroy()
  })

  it('placeCursorAfterTable does not throw for table ending document', () => {
    parent = document.createElement('div')
    document.body.appendChild(parent)
    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |'
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'mouse' }
    })
    const tableTo = view.state.doc.line(3).to

    expect(() => placeCursorAfterTable(view, tableTo)).not.toThrow()
    expect(view.state.selection.main.head).toBeLessThanOrEqual(view.state.doc.length)

    view.destroy()
  })
})
