import { describe, it, expect, afterEach } from 'vitest'
import { ensureSyntaxTree } from '@codemirror/language'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'
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
})
