import { describe, it, expect, afterEach, vi } from 'vitest'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'

async function waitForCkantTable(parent: HTMLElement): Promise<void> {
  await vi.waitFor(() => {
    expect(parent.querySelector('.tbl-table')).toBeTruthy()
  })
}

/** 桌面端使用 codemirror-markdown-tables（ckant） */
describe('codemirror-markdown-tables desktop', () => {
  let parent: HTMLElement | null = null

  afterEach(() => {
    parent?.remove()
    parent = null
  })

  it('renders interactive tbl-table widget', async () => {
    parent = document.createElement('div')
    parent.style.width = '480px'
    document.body.appendChild(parent)

    const view = createDiaryCodeMirror(parent, {
      content: '| A | B |\n| --- | --- |\n| 1 | 2 |',
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'mouse' }
    })

    await waitForCkantTable(parent)

    expect(parent.textContent).toContain('A')
    expect(parent.textContent).toContain('1')
    view.destroy()
  })

  it('preserves markdown document on open', async () => {
    parent = document.createElement('div')
    document.body.appendChild(parent)
    const doc = '| Name | Value |\n| --- | --- |\n| foo | bar |\n\nHello world'

    const view = createDiaryCodeMirror(parent, {
      content: doc,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'mouse' }
    })

    expect(view.state.doc.toString()).toContain('| Name | Value |')
    expect(view.state.doc.toString()).toContain('foo')
    expect(view.state.doc.toString()).toContain('Hello world')
    await waitForCkantTable(parent)
    view.destroy()
  })

  it('does not use legacy cm-table-block desktop widget', () => {
    parent = document.createElement('div')
    parent.style.width = '480px'
    document.body.appendChild(parent)

    const view = createDiaryCodeMirror(parent, {
      content: '| A | B |\n| --- | --- |\n| 1 | 2 |',
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'mouse' }
    })

    expect(parent.querySelector('.cm-table-block--desktop')).toBeFalsy()
    view.destroy()
  })
})
