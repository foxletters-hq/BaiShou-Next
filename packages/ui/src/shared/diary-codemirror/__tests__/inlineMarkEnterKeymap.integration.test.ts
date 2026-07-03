import { describe, it, expect, afterEach } from 'vitest'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'
import { continueInlineMarkAtLineEnd } from '../extensions/inlineMarkEnterKeymap'
import type { EditorView } from '@codemirror/view'

describe('inline mark Enter at line end', () => {
  let parent: HTMLDivElement
  let view: EditorView | null = null

  afterEach(() => {
    view?.destroy()
    parent?.remove()
    view = null
  })

  it('inserts newline after ** when cursor is on closing delimiter', () => {
    const content = '**bold**\n'
    parent = document.createElement('div')
    document.body.appendChild(parent)
    view = createDiaryCodeMirror(parent, {
      content,
      platform: {
        resolveAttachmentUrl: (u) => u,
        interactionMode: 'touch',
        scrollMode: 'viewport'
      }
    })

    // 模拟点击视觉末尾后落在闭合 ** 上
    view.dispatch({ selection: { anchor: 6, head: 6 } })
    expect(continueInlineMarkAtLineEnd(view)).toBe(true)

    expect(view.state.doc.toString()).toBe('**bold**\n\n')
  })
})
