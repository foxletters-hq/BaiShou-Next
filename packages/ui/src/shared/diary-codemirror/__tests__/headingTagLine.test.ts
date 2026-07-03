import { describe, it, expect, afterEach } from 'vitest'
import { syntaxTree, ensureSyntaxTree } from '@codemirror/language'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'
import type { EditorView } from '@codemirror/view'

describe('heading with diary tag line (screenshot case)', () => {
  let parent: HTMLDivElement
  let view: EditorView | null = null

  afterEach(() => {
    view?.destroy()
    parent?.remove()
    view = null
  })

  it('renders ##### 07:00 as h5 with tagLineMode', () => {
    const content = '##### 07:00\n#阅读 #独处\n'
    parent = document.createElement('div')
    document.body.appendChild(parent)
    view = createDiaryCodeMirror(parent, {
      content,
      platform: {
        resolveAttachmentUrl: (u) => u,
        interactionMode: 'touch',
        scrollMode: 'viewport',
        tagLineMode: true
      }
    })

    const headingNodes: string[] = []
    ensureSyntaxTree(view.state, content.length, 200)
    syntaxTree(view.state).iterate({
      enter(node) {
        if (node.name.startsWith('ATXHeading')) headingNodes.push(node.name)
      }
    })
    expect(headingNodes).toContain('ATXHeading5')

    const firstLine = parent.querySelector('.cm-line')
    expect(firstLine?.querySelector('.cm-rendered-h5')).not.toBeNull()
    expect(firstLine?.textContent).toContain('07:00')
    expect(parent.querySelectorAll('.cm-syntax-hidden-widget').length).toBeGreaterThan(0)
  })
})
