import { describe, it, expect, afterEach } from 'vitest'
import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'
import { buildMarkerHidingDecorations } from '../extensions/build'
import { editorFocusEffect } from '../extensions/editorFocus'
import type { EditorView } from '@codemirror/view'

describe('live preview marker hiding', () => {
  let parent: HTMLDivElement
  let view: EditorView | null = null

  afterEach(() => {
    view?.destroy()
    parent?.remove()
    view = null
  })

  function mount(content: string, cursor = content.length) {
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
    if (cursor !== content.length) {
      view.dispatch({ selection: { anchor: cursor, head: cursor } })
    }
    ensureSyntaxTree(view.state, view.state.doc.length, 200)
    return view
  }

  function focusEditor(view: EditorView) {
    view.dispatch({ effects: editorFocusEffect.of(true) })
    view.focus()
  }

  it('hides ** markers and applies heading class for short doc', () => {
    mount('**bold** text\n# h1\n')
    expect(parent.querySelectorAll('.cm-syntax-hidden-widget').length).toBeGreaterThan(0)
    expect(parent.querySelector('.cm-rendered-h1')).not.toBeNull()
  })

  it('hides ** when cursor is after emphasis', () => {
    const v = mount('hello\n')
    v.dispatch({
      changes: { from: 6, insert: '**bold**' },
      selection: { anchor: 14, head: 14 }
    })
    expect(parent.querySelectorAll('.cm-syntax-hidden-widget').length).toBeGreaterThan(0)
  })

  it('renders heading at end of long document', () => {
    const content = `${'x\n'.repeat(50)}##### 五级标题\n`
    mount(content)
    expect(parent.querySelector('.cm-rendered-h5')).not.toBeNull()
    expect(parent.querySelectorAll('.cm-syntax-hidden-widget').length).toBeGreaterThan(0)
  })

  it('renders distinct heading levels', () => {
    mount('# one\n## two\n### three\n')
    expect(parent.querySelector('.cm-rendered-h1')).not.toBeNull()
    expect(parent.querySelector('.cm-rendered-h2')).not.toBeNull()
    expect(parent.querySelector('.cm-rendered-h3')).not.toBeNull()
  })

  it('hides inline code backticks and styles content', () => {
    mount('use `code` here\n')
    expect(parent.querySelector('.cm-rendered-inline-code')).not.toBeNull()
    expect(parent.querySelectorAll('.cm-syntax-hidden-widget').length).toBeGreaterThan(0)
  })

  it('renders blockquote with left rail', () => {
    mount('> quoted line\n')
    expect(parent.querySelector('.cm-rendered-blockquote-content')).not.toBeNull()
    expect(parent.querySelectorAll('.cm-syntax-hidden-widget').length).toBeGreaterThan(0)
  })

  it('hides ** on same line when cursor is outside emphasis', () => {
    const content = '明天**继续**前进'
    const cursor = content.indexOf('前')
    const v = mount(content, cursor)
    focusEditor(v)
    expect(parent.querySelectorAll('.cm-syntax-hidden-widget').length).toBeGreaterThanOrEqual(2)
    expect(parent.textContent).not.toMatch(/\*\*继续\*\*/)
  })

  it('shows ** when cursor is inside emphasis', () => {
    const content = '明天**继续**前进'
    const cursor = content.indexOf('继')
    const v = mount(content, cursor)
    focusEditor(v)
    expect(v.state.doc.toString()).toContain('**继续**')
  })

  it('renders fenced code with gray line background when cursor is outside', () => {
    const content = '```\n你好\n```\n\nafter'
    const v = mount(content, content.length)
    focusEditor(v)
    expect(parent.querySelectorAll('.cm-code-line').length).toBeGreaterThan(0)
    expect(parent.textContent).toContain('你好')
    expect(parent.textContent).not.toMatch(/```/)
  })

  it('shows fence markers when cursor is inside fenced block', () => {
    const content = '```\n你好\n```\n'
    const openFencePos = content.indexOf('```')
    const v = mount(content, openFencePos + 1)
    focusEditor(v)
    expect(parent.querySelectorAll('.cm-code-line').length).toBeGreaterThan(0)
    expect(v.state.doc.toString()).toContain('```')
  })

  it('hides fence markers outside active fenced block lines', () => {
    const content = '```\n你好\n```\n'
    const state = EditorState.create({
      doc: content,
      selection: { anchor: content.length, head: content.length },
      extensions: [markdown()]
    })
    ensureSyntaxTree(state, state.doc.length, 200)
    const deco = buildMarkerHidingDecorations(
      state,
      { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' },
      { hasFocus: true }
    )
    let hiddenFenceCount = 0
    deco.between(0, state.doc.length, (_from, _to, value) => {
      if (value.spec?.widget?.constructor.name === 'HiddenSyntaxWidget') hiddenFenceCount += 1
    })
    expect(hiddenFenceCount).toBeGreaterThan(0)
  })

  it('renders fenced code inline for block followed by body text', () => {
    const content = 'sjsj\n```\ntube\nhhh\n```\nthg'
    const v = mount(content, content.length)
    focusEditor(v)
    expect(parent.querySelectorAll('.cm-code-line').length).toBeGreaterThan(0)
    expect(parent.textContent).toContain('tube')
    expect(parent.textContent).toContain('thg')
    expect(parent.textContent).not.toMatch(/```/)
  })

  it('moving caret into fenced block reveals fences without doc change', () => {
    const content = '```\ntube\n```\nthg'
    const v = mount(content, content.length)
    const thgPos = content.indexOf('thg')
    const closeFencePos = content.lastIndexOf('```')
    v.dispatch({ selection: { anchor: closeFencePos, head: closeFencePos } })
    focusEditor(v)
    expect(v.state.doc.toString()).toBe(content)
    v.dispatch({ selection: { anchor: thgPos, head: thgPos } })
    expect(v.state.doc.toString()).toBe(content)
    expect(v.state.doc.toString()).not.toContain('```thg')
  })

  function isOpenFenceHidden(state: EditorState, doc: string) {
    const openFence = doc.indexOf('```')
    const deco = buildMarkerHidingDecorations(
      state,
      { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' },
      { hasFocus: true }
    )
    let hidden = false
    deco.between(openFence, openFence + 3, (_f, _t, value) => {
      if (value.spec?.widget?.constructor.name === 'HiddenSyntaxWidget') {
        hidden = true
      }
    })
    return hidden
  }

  it('re-entering fenced block shows fence markers again', () => {
    const content = '```\ntube\n```\nthg'
    const insidePos = content.indexOf('tube')
    const outsidePos = content.indexOf('thg')
    const v = mount(content, outsidePos)
    focusEditor(v)

    expect(isOpenFenceHidden(v.state, content)).toBe(true)

    v.dispatch({ selection: { anchor: insidePos, head: insidePos } })
    expect(isOpenFenceHidden(v.state, content)).toBe(false)

    v.dispatch({ selection: { anchor: outsidePos, head: outsidePos } })
    expect(isOpenFenceHidden(v.state, content)).toBe(true)

    v.dispatch({ selection: { anchor: insidePos, head: insidePos } })
    expect(isOpenFenceHidden(v.state, content)).toBe(false)
  })

  it('touch mode does not stack cm-table-line decorations with table widget', () => {
    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n\nafter'
    const v = mount(content, content.length)
    focusEditor(v)
    expect(parent.querySelectorAll('.cm-table-block').length).toBe(1)
    expect(parent.querySelectorAll('.cm-table-line').length).toBe(0)
  })

  it('table plus fenced block does not insert extra gap on caret move', async () => {
    const table = '| A | B |\n| --- | --- |\n| 1 | 2 |'
    const content = `${table}\n\n\`\`\`\ntube\n\`\`\`\nthg`
    const v = mount(content, content.length)
    await new Promise((r) => queueMicrotask(r))
    const before = v.state.doc.toString()
    const thgPos = v.state.doc.toString().indexOf('thg')
    v.dispatch({ selection: { anchor: thgPos, head: thgPos } })
    await new Promise((r) => queueMicrotask(r))
    await new Promise((r) => queueMicrotask(r))
    expect(v.state.doc.toString()).toBe(before)
  })
})
