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

  function mount(
    content: string,
    cursor = content.length,
    interactionMode: 'touch' | 'mouse' = 'touch',
    documentProperties = false
  ) {
    parent = document.createElement('div')
    document.body.appendChild(parent)
    view = createDiaryCodeMirror(parent, {
      content,
      platform: {
        resolveAttachmentUrl: (u) => u,
        interactionMode,
        scrollMode: 'viewport',
        documentProperties
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

  it('puts heading class on the line so click mapping uses line metrics', () => {
    mount('# heading\nnext\n', 0, 'mouse')
    const line = parent.querySelector('.cm-line')
    expect(line?.classList.contains('cm-rendered-h1')).toBe(true)
  })

  it('hides inline code backticks when the caret is outside', () => {
    mount('use `code` here\n')
    const el = parent.querySelector('.cm-rendered-inline-code')
    expect(el).not.toBeNull()
    expect(el?.textContent).toBe('code')
    expect(parent.querySelectorAll('.cm-syntax-hidden-widget').length).toBeGreaterThan(0)
    expect(parent.textContent).not.toMatch(/`code`/)
  })

  it('keeps inline code backticks inside the mark when the caret is inside', () => {
    const content = 'use `code` here\n'
    mount(content, content.indexOf('c'))
    const el = parent.querySelector('.cm-rendered-inline-code')
    expect(el?.textContent).toBe('`code`')
  })

  it('hides inline code backticks after the caret leaves the span', () => {
    const content = 's`sadas`\n'
    const v = mount(content, content.indexOf('a'))
    focusEditor(v)
    expect(parent.querySelector('.cm-rendered-inline-code')?.textContent).toBe('`sadas`')

    v.dispatch({ selection: { anchor: content.length, head: content.length } })
    expect(parent.querySelector('.cm-rendered-inline-code')?.textContent).toBe('sadas')
    expect(parent.textContent).not.toMatch(/`sadas`/)
  })

  it('covers the full inline code range including backticks while editing', () => {
    const content = 'use `code` here\n'
    const inside = content.indexOf('c')
    const state = EditorState.create({
      doc: content,
      selection: { anchor: inside, head: inside },
      extensions: [markdown()]
    })
    ensureSyntaxTree(state, state.doc.length, 200)
    const deco = buildMarkerHidingDecorations(
      state,
      { resolveAttachmentUrl: (u) => u, interactionMode: 'mouse' },
      { hasFocus: true }
    )
    const openTick = content.indexOf('`')
    const closeTick = content.lastIndexOf('`')
    let covered = false
    let hiddenTicks = 0
    deco.between(openTick, closeTick + 1, (from, to, value) => {
      if (
        value.spec?.class === 'cm-rendered-inline-code' &&
        from <= openTick &&
        to >= closeTick + 1
      ) {
        covered = true
      }
      if (value.spec?.widget?.constructor.name === 'HiddenSyntaxWidget') {
        hiddenTicks += 1
      }
    })
    expect(covered).toBe(true)
    expect(hiddenTicks).toBe(0)
  })

  it('renders blockquote with left rail', () => {
    mount('> quoted line\n')
    expect(parent.querySelector('.cm-rendered-blockquote')).not.toBeNull()
  })

  it('keeps blockquote rail when the caret is on the quote line', () => {
    const content = '> quoted line\n'
    const v = mount(content, content.indexOf('q'))
    focusEditor(v)
    expect(parent.querySelector('.cm-rendered-blockquote')).not.toBeNull()
  })

  it('renders --- as a visual horizontal rule when cursor is elsewhere', () => {
    const content = 'before\n---\nafter\n'
    const v = mount(content, content.length)
    focusEditor(v)
    expect(parent.querySelector('.cm-wb-hr')).not.toBeNull()
    expect(parent.querySelector('.cm-wb-hr-widget')).not.toBeNull()
    expect(parent.textContent).not.toContain('---')
  })

  it('shows raw --- when cursor is on the horizontal rule line', () => {
    const content = 'before\n---\nafter\n'
    const hrPos = content.indexOf('-')
    const v = mount(content, hrPos)
    focusEditor(v)
    expect(parent.querySelector('.cm-wb-hr')).not.toBeNull()
    expect(parent.querySelector('.cm-wb-hr-widget')).toBeNull()
    expect(v.state.doc.toString()).toContain('---')
  })

  it('renders skill properties header instead of a horizontal rule', () => {
    const content = 'name: daily-news-digest\ndescription: 整理当天新闻\n\n# 简报\n'
    mount(content, content.length, 'mouse', true)
    expect(parent.querySelector('.cm-wb-properties')).not.toBeNull()
    expect(parent.querySelector('.cm-wb-property-key')).not.toBeNull()
    expect(parent.querySelector('.cm-wb-hr')).toBeNull()
  })

  it('does not render yaml fences in skill properties as a horizontal rule', () => {
    const content = '---\nname: translate\ndescription: 翻译\n---\n\n请翻译\n'
    mount(content, content.length, 'mouse', true)
    expect(parent.querySelector('.cm-wb-properties')).not.toBeNull()
    expect(parent.querySelector('.cm-wb-hr')).toBeNull()
    expect(parent.querySelector('.cm-wb-hr-widget')).toBeNull()
  })

  it('does not extend blockquote styling to lines without > prefix', () => {
    mount('> quoted line\nplain line\n')
    expect(parent.querySelectorAll('.cm-rendered-blockquote').length).toBe(1)
    expect(parent.textContent).toContain('plain line')
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

  it('does not throw for blockquote lines with live preview decorations', () => {
    const content = '> quoted\nplain\n'
    const state = EditorState.create({
      doc: content,
      selection: { anchor: 2, head: 2 },
      extensions: [markdown()]
    })
    ensureSyntaxTree(state, state.doc.length, 200)
    expect(() =>
      buildMarkerHidingDecorations(
        state,
        { resolveAttachmentUrl: (u) => u, interactionMode: 'mouse' },
        { hasFocus: true }
      )
    ).not.toThrow()
  })

  it('does not add list widgets inside fenced code blocks', () => {
    const content = '```\n- not a list\n```\n'
    const state = EditorState.create({
      doc: content,
      selection: { anchor: content.indexOf('not'), head: content.indexOf('not') },
      extensions: [markdown()]
    })
    ensureSyntaxTree(state, state.doc.length, 200)
    const deco = buildMarkerHidingDecorations(
      state,
      { resolveAttachmentUrl: (u) => u, interactionMode: 'mouse' },
      { hasFocus: true }
    )
    let listWidgetCount = 0
    deco.between(0, state.doc.length, (_from, _to, value) => {
      if (value.spec?.widget?.constructor.name === 'ListBulletWidget') listWidgetCount += 1
    })
    expect(listWidgetCount).toBe(0)
  })

  it('does not throw when building decorations for fenced code with inline backticks', () => {
    const content = '```\nconst x = `y`\n```\n'
    const state = EditorState.create({
      doc: content,
      selection: { anchor: content.indexOf('y'), head: content.indexOf('y') },
      extensions: [markdown()]
    })
    ensureSyntaxTree(state, state.doc.length, 200)
    expect(() =>
      buildMarkerHidingDecorations(
        state,
        { resolveAttachmentUrl: (u) => u, interactionMode: 'touch' },
        { hasFocus: true }
      )
    ).not.toThrow()
  })

  it('styles unclosed fenced blocks consistently via line scan', () => {
    const content = 'intro\n```\nline one\nline two'
    mount(content, content.length)
    expect(parent.querySelectorAll('.cm-code-line').length).toBe(3)
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

  it('mounts complex diary content without decoration errors', () => {
    const content = [
      '##### 10:31',
      '',
      '阿```',
      '',
      '```',
      'asdasdasdas dqw',
      'sadasd',
      '```',
      '',
      '> quoted',
      'plain'
    ].join('\n')
    const v = mount(content, content.indexOf('dqw'))
    focusEditor(v)
    expect(() => {
      v.dispatch({
        selection: { anchor: content.indexOf('quoted'), head: content.indexOf('quoted') }
      })
      v.dispatch({
        selection: { anchor: content.indexOf('```', 10), head: content.indexOf('```', 10) + 1 }
      })
      buildMarkerHidingDecorations(
        v.state,
        { resolveAttachmentUrl: (u) => u, interactionMode: 'mouse' },
        { hasFocus: true }
      )
    }).not.toThrow()
  })

  it('mouse mode click does not throw on complex diary content', () => {
    const content = [
      '##### 10:31',
      '',
      '阿```',
      '',
      '```',
      'asdasdasdas dqw',
      'sadasd',
      '```',
      '',
      '> quoted',
      'plain'
    ].join('\n')
    const v = mount(content, content.indexOf('plain'), 'mouse')
    focusEditor(v)
    expect(() => {
      v.dom.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
      v.dispatch({
        selection: { anchor: content.indexOf('quoted'), head: content.indexOf('quoted') }
      })
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    }).not.toThrow()
  })

  it('hides markdown link destination until the caret enters the link', () => {
    const content =
      '来源（[每日经济新闻](https://www.nbd.com.cn/articles/2026-08-18/4545630.html)）完'
    const v = mount(content, content.length)
    focusEditor(v)
    expect(parent.querySelector('.cm-rendered-link')).not.toBeNull()
    expect(parent.textContent).toContain('每日经济新闻')
    expect(parent.textContent).not.toContain('https://www.nbd.com.cn')
    expect(parent.textContent).not.toMatch(/\]\(/)

    const labelPos = content.indexOf('每日')
    v.dispatch({ selection: { anchor: labelPos, head: labelPos } })
    expect(v.state.doc.toString()).toContain('https://www.nbd.com.cn')
    expect(parent.textContent).toContain('https://www.nbd.com.cn')
  })

  it('keeps image markdown out of inline link collapsing', () => {
    const content = '见图 ![照片](attachment/photo.png)\n'
    const v = mount(content, content.length)
    focusEditor(v)
    expect(parent.querySelector('.cm-rendered-link')).toBeNull()
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
