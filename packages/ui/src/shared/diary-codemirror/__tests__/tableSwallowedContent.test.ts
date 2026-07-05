import { describe, it, expect, afterEach } from 'vitest'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'
import { buildMarkerHidingDecorations } from '../extensions/build'

describe('table swallowed post-table content', () => {
  let parent: HTMLElement | null = null

  afterEach(() => {
    parent?.remove()
    parent = null
  })

  it('does not decorate swallowed paragraphs as cm-table-line rows', () => {
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)

    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\nwjwj\ndkdn'
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })

    const tableLines = parent.querySelectorAll('.cm-table-line')
    const lineTexts = [...tableLines].map((el) => el.textContent ?? '')
    expect(lineTexts.some((t) => t.includes('wjwj'))).toBe(false)
    expect(lineTexts.some((t) => t.includes('dkdn'))).toBe(false)
    expect(parent.querySelector('.cm-table-block')).toBeTruthy()

    view.destroy()
  })

  it('buildMarkerHidingDecorations skips table-line chrome for swallowed text', () => {
    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\nwjwj\ndkdn'
    const view = createDiaryCodeMirror(document.createElement('div'), {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'mouse' }
    })

    const wjwjFrom = view.state.doc.toString().indexOf('wjwj')
    const deco = buildMarkerHidingDecorations(view.state)
    const iter = deco.iter()
    let wjwjHasTableLine = false
    while (iter.value) {
      const cls = iter.value.spec?.attributes?.class ?? iter.value.spec?.class ?? ''
      if (
        typeof cls === 'string' &&
        cls.includes('cm-table-line') &&
        iter.from <= wjwjFrom &&
        iter.to >= wjwjFrom
      ) {
        wjwjHasTableLine = true
      }
      iter.next()
    }
    expect(wjwjHasTableLine).toBe(false)

    view.destroy()
  })

  it('repairs missing gap so post-table text is separated from the table', async () => {
    parent = document.createElement('div')
    document.body.appendChild(parent)

    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\nwjwj'
    const view = createDiaryCodeMirror(parent, {
      content,
      platform: { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' }
    })

    await new Promise((r) => queueMicrotask(r))
    await new Promise((r) => queueMicrotask(r))
    const doc = view.state.doc.toString()
    expect(doc).toMatch(/\| 1 \| 2 \|\n\nwjwj/)

    view.destroy()
  })
})
