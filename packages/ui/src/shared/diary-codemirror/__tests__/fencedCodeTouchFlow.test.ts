import { describe, it, expect, afterEach } from 'vitest'
import { ensureSyntaxTree } from '@codemirror/language'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'
import { collectFencedCodeBlockRanges } from '../extensions/fencedCodeScan'
import { buildMarkerHidingDecorations } from '../extensions/build'
import { editorFocusEffect } from '../extensions/editorFocus'
import type { EditorView } from '@codemirror/view'

describe('fenced code inline touch flow', () => {
  let parent: HTMLDivElement | null = null
  let view: EditorView | null = null

  afterEach(() => {
    view?.destroy()
    parent?.remove()
    view = null
    parent = null
  })

  async function flushMicrotasks(rounds = 4) {
    for (let i = 0; i < rounds; i += 1) {
      await new Promise((r) => queueMicrotask(r))
    }
  }

  function mount(content: string) {
    parent = document.createElement('div')
    parent.style.width = '400px'
    document.body.appendChild(parent)
    view = createDiaryCodeMirror(parent, {
      content,
      platform: {
        resolveAttachmentUrl: (u) => u,
        interactionMode: 'touch',
        scrollMode: 'viewport'
      }
    })
    ensureSyntaxTree(view.state, view.state.doc.length, 200)
    return view
  }

  async function mountAndSettle(content: string) {
    const v = mount(content)
    await flushMicrotasks()
    return v
  }

  it('uses inline code lines instead of preview widgets', async () => {
    const content = '```\ntube\nhhh\n```\nthg'
    const v = await mountAndSettle(content)
    expect(parent!.querySelectorAll('.cm-rendered-fenced-code')).toHaveLength(0)
    expect(parent!.querySelectorAll('.cm-code-line').length).toBeGreaterThan(0)
    expect(collectFencedCodeBlockRanges(v.state.doc)).toHaveLength(1)
  })

  it('caret on close fence then outside keeps doc stable', async () => {
    const table = '| A | B |\n| --- | --- |\n| 1 | 2 |'
    const content = `${table}\n\n\`\`\`\ntube\nhhh\n\`\`\`\nthg`
    const v = await mountAndSettle(content)
    const initialDoc = v.state.doc.toString()
    const closeFencePos = content.lastIndexOf('```')
    const outsidePos = v.state.doc.toString().indexOf('thg')

    for (let i = 0; i < 3; i += 1) {
      v.dispatch({ selection: { anchor: closeFencePos, head: closeFencePos } })
      await flushMicrotasks()
      v.dispatch({ selection: { anchor: outsidePos, head: outsidePos } })
      await flushMicrotasks()
    }

    expect(v.state.doc.toString()).toBe(initialDoc)
    expect(collectFencedCodeBlockRanges(v.state.doc)).toHaveLength(1)
    expect(parent!.querySelectorAll('.cm-rendered-fenced-code')).toHaveLength(0)
  })

  it('touch re-entry into fenced block reveals open fence markers', async () => {
    const content = '```\ntube\n```\nthg'
    const v = await mountAndSettle(content)
    v.dispatch({ effects: editorFocusEffect.of(true) })
    const outsidePos = v.state.doc.toString().indexOf('thg')
    const insidePos = v.state.doc.toString().indexOf('tube')
    const openFence = content.indexOf('```')

    const isOpenFenceHidden = () => {
      let hidden = false
      buildMarkerHidingDecorations(
        v!.state,
        { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' },
        { hasFocus: true }
      ).between(openFence, openFence + 3, (_f, _t, value) => {
        if (value.spec?.widget?.constructor.name === 'HiddenSyntaxWidget') {
          hidden = true
        }
      })
      return hidden
    }

    v.dispatch({ selection: { anchor: outsidePos, head: outsidePos } })
    await flushMicrotasks()
    expect(isOpenFenceHidden()).toBe(true)

    const lineEl = v.contentDOM.querySelector('.cm-code-line') as HTMLElement | null
    expect(lineEl).not.toBeNull()

    const fireTap = () => {
      lineEl!.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 })
      )
      v.dispatch({ selection: { anchor: insidePos, head: insidePos } })
      lineEl!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))
    }

    fireTap()
    await flushMicrotasks()
    expect(isOpenFenceHidden()).toBe(false)

    v.dispatch({ selection: { anchor: outsidePos, head: outsidePos } })
    await flushMicrotasks()
    expect(isOpenFenceHidden()).toBe(true)

    fireTap()
    await flushMicrotasks()
    expect(isOpenFenceHidden()).toBe(false)
  })
})
