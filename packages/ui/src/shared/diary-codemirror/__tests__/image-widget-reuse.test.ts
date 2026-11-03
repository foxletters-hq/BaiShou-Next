import { afterEach, describe, expect, it } from 'vitest'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'
import { buildImageMarkdown, parseImageMarkdown } from '../utils/image-utils'
import { ImageWidget } from '../widgets/ImageWidget'
import type { EditorView } from '@codemirror/view'

function makeWidget(width: number, from = 0, to = 20) {
  return new ImageWidget('local:///a.png', 'a', width, from, to, false, 'attachment/a.png', {
    resolveAttachmentUrl: (url) => url,
    interactionMode: 'mouse'
  })
}

describe('ImageWidget width updates', () => {
  let parent: HTMLDivElement
  let view: EditorView | null = null

  afterEach(() => {
    view?.destroy()
    parent?.remove()
    view = null
  })

  it('reuses the loaded img element and updates width in place', () => {
    const previous = makeWidget(300)
    const dom = previous.toDOM()
    const img = dom.querySelector('img')

    const next = makeWidget(420, 2, 22)
    expect(next.eq(previous)).toBe(false)
    expect(next.updateDOM(dom)).toBe(true)

    expect(dom.style.width).toBe('420px')
    expect(dom.querySelector('img')).toBe(img)

    dom.remove()
  })

  it('keeps the same img element when the markdown width is rewritten', () => {
    parent = document.createElement('div')
    document.body.appendChild(parent)
    view = createDiaryCodeMirror(parent, {
      content: '![a](local:///a.png | 300)\n',
      platform: {
        resolveAttachmentUrl: (url) => url,
        interactionMode: 'mouse',
        scrollMode: 'viewport'
      }
    })

    const before = parent.querySelector('.cm-image-resizable')
    expect(before).not.toBeNull()

    const parsed = parseImageMarkdown(view.state.doc.toString())
    expect(parsed).not.toBeNull()
    view.dispatch({
      changes: {
        from: parsed!.from,
        to: parsed!.to,
        insert: buildImageMarkdown(parsed!.alt, parsed!.src, 420)
      }
    })

    const after = parent.querySelector('.cm-image-resizable')
    expect(after).toBe(before)
    const container = parent.querySelector('.cm-image-container') as HTMLElement
    expect(container.style.width).toBe('420px')
  })

  it('reuses detached DOM and img across destroy and toDOM when scrolling out and back into viewport', () => {
    const first = new ImageWidget(
      'local:///scroll-pool.png',
      'scroll',
      300,
      0,
      30,
      false,
      'attachment/scroll-pool.png',
      {
        resolveAttachmentUrl: (url) => url,
        interactionMode: 'mouse'
      }
    )
    const dom = first.toDOM()
    const img = dom.querySelector('img')
    Object.defineProperty(dom, 'offsetHeight', { value: 275, configurable: true })

    // Simulate CodeMirror unmounting the widget when scrolled past viewport margin
    first.destroy(dom)
    dom.remove()

    const remounted = new ImageWidget(
      'local:///scroll-pool.png',
      'scroll',
      340,
      0,
      30,
      false,
      'attachment/scroll-pool.png',
      {
        resolveAttachmentUrl: (url) => url,
        interactionMode: 'mouse'
      }
    )
    expect(remounted.estimatedHeight).toBe(275)

    const nextDom = remounted.toDOM()
    expect(nextDom).toBe(dom)
    expect(nextDom.querySelector('img')).toBe(img)
    expect(nextDom.style.width).toBe('340px')
  })
})
