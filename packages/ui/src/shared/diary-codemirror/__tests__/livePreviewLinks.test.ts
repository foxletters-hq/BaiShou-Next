import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EditorView } from '@codemirror/view'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'
import { buildMarkerHidingDecorations } from '../extensions/build'

import { editorFocusEffect } from '../extensions/editorFocus'

describe('live preview links', () => {
  let parent: HTMLDivElement | null = null
  let view: EditorView | null = null

  afterEach(() => {
    view?.destroy()
    view = null
    parent?.remove()
    parent = null
  })

  function mount(content: string, cursor = content.length) {
    parent = document.createElement('div')
    document.body.appendChild(parent)
    view = createDiaryCodeMirror(parent, {
      content,
      platform: {
        resolveAttachmentUrl: (u) => u,
        interactionMode: 'mouse'
      }
    })
    if (cursor !== content.length) {
      view.dispatch({ selection: { anchor: cursor, head: cursor } })
    }
    return view
  }

  function focusEditor(v: EditorView) {
    v.dispatch({ effects: editorFocusEffect.of(true) })
    v.focus()
  }

  it('renders a nested source list as hyperlinks', () => {
    const content = [
      '- **来源**：',
      '  - [The Verge](https://www.theverge.com/ai-artificial-intelligence/999874/openai-agents-hacked-an-australian-government-website-in-search-for-data)',
      '  - [WIRED](https://www.wired.com/story/example)'
    ].join('\n')
    const v = mount(content, 0)
    focusEditor(v)
    const deco = buildMarkerHidingDecorations(
      v.state,
      { resolveAttachmentUrl: (url) => url, interactionMode: 'mouse' },
      { hasFocus: true }
    )
    let linkMarks = 0
    deco.between(0, v.state.doc.length, (_from, _to, value) => {
      if (value.spec.class === 'cm-rendered-link') linkMarks += 1
    })
    expect(linkMarks).toBe(2)
    expect(parent?.textContent).toContain('The Verge')
    expect(parent?.textContent).not.toContain('www.theverge.com')
    expect(parent?.textContent).not.toMatch(/\]\(/)
  })

  it('hides markdown link destination until the caret enters the link', () => {
    const content =
      '来源（[每日经济新闻](https://www.nbd.com.cn/articles/2026-08-18/4545630.html)）完'
    const v = mount(content, content.length)
    focusEditor(v)
    expect(parent?.querySelector('.cm-rendered-link')).not.toBeNull()
    expect(parent?.textContent).toContain('每日经济新闻')
    expect(parent?.textContent).not.toContain('https://www.nbd.com.cn')
    expect(parent?.textContent).not.toMatch(/\]\(/)

    const labelPos = content.indexOf('每日')
    v.dispatch({ selection: { anchor: labelPos, head: labelPos } })
    expect(v.state.doc.toString()).toContain('https://www.nbd.com.cn')
    expect(parent?.textContent).toContain('https://www.nbd.com.cn')

    const afterLink = content.indexOf('）完')
    v.dispatch({ selection: { anchor: afterLink, head: afterLink } })
    expect(parent?.textContent).not.toContain('https://www.nbd.com.cn')
  })

  it('opens the rendered link in the browser when modifier clicked', () => {
    const onOpenExternalLink = vi.fn()
    const content = '[凤凰科技（中文）](https://tech.ifeng.com/c/8wfxoSixH8y)\n'
    view?.destroy()
    parent?.remove()
    parent = document.createElement('div')
    document.body.appendChild(parent)
    view = createDiaryCodeMirror(parent, {
      content,
      platform: {
        resolveAttachmentUrl: (url) => url,
        interactionMode: 'mouse',
        onOpenExternalLink
      }
    })
    focusEditor(view)
    const link = parent.querySelector('.cm-rendered-link')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('data-href')).toBe('https://tech.ifeng.com/c/8wfxoSixH8y')
    link?.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }))
    expect(onOpenExternalLink).toHaveBeenCalledWith('https://tech.ifeng.com/c/8wfxoSixH8y')
  })

  it('does not turn into blue link when caret sits on the text label', () => {
    const content = '[凤凰科技（中文）](https://tech.ifeng.com/c/8wfxoSixH8y)\n'
    const labelPos = content.indexOf('凤凰')
    const v = mount(content, labelPos)
    focusEditor(v)
    expect(parent?.querySelector('.cm-rendered-link')).toBeNull()
    expect(parent?.textContent).toContain('https://tech.ifeng.com')
  })
})
