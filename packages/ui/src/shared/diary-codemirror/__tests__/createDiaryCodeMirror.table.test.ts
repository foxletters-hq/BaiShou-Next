import { describe, it, expect, afterEach, vi } from 'vitest'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'

async function waitForCkantTable(parent: HTMLElement): Promise<void> {
  await vi.waitFor(() => {
    expect(parent.querySelector('.tbl-table')).toBeTruthy()
  })
}

describe('createDiaryCodeMirror with table', () => {
  let parent: HTMLElement | null = null

  afterEach(() => {
    parent?.remove()
    parent = null
  })

  it('creates editor without throwing when document contains a table', () => {
    parent = document.createElement('div')
    document.body.appendChild(parent)
    const doc = '| Name | Value |\n| --- | --- |\n| foo | bar |\n\nHello world'

    let view
    expect(() => {
      view = createDiaryCodeMirror(parent!, {
        content: doc,
        platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'mouse' }
      })
    }).not.toThrow()

    expect(parent!.querySelector('.cm-editor')).toBeTruthy()
    expect(parent!.textContent).toMatch(/Hello|foo|Name/)
    view!.destroy()
  })

  it('renders table block widget in DOM when document is only a table', async () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    parent.style.height = '300px'
    document.body.appendChild(parent)
    const doc = '| A | B |\n| --- | --- |\n| 1 | 2 |'

    const view = createDiaryCodeMirror(parent, {
      content: doc,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'mouse' }
    })

    // 模拟打开日记后光标移到文末（表格外）
    expect(() => {
      const end = view.state.doc.length
      view.dispatch({ selection: { anchor: end, head: end } })
    }).not.toThrow()

    await waitForCkantTable(parent!)
    expect(parent!.textContent).toContain('A')
    view.destroy()
  })

  it('ckant handles table widget without tableEditorPlugin redirect', async () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)
    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\n'

    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'mouse' }
    })

    view.dispatch({ selection: { anchor: 2, head: 2 } })
    await new Promise((resolve) => queueMicrotask(resolve))

    expect(view.state.doc.toString()).toContain('| A | B |')
    expect(view.state.doc.toString()).toContain('| 1 | 2 |')
    await waitForCkantTable(parent!)

    view.destroy()
  })
})
