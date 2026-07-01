import { describe, it, expect, afterEach } from 'vitest'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'

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

  it('renders table block widget in DOM when document is only a table', () => {
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
      view.dispatch({ selection: { anchor: doc.length, head: doc.length } })
    }).not.toThrow()

    expect(parent.querySelector('.cm-table-block')).toBeTruthy()
    expect(parent.textContent).toContain('A')
    view.destroy()
  })
})
