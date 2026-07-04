import { describe, it, expect } from 'vitest'
import { EditorView } from '@codemirror/view'
import { createDiaryCodeMirror } from '../createDiaryCodeMirror'
import { replaceEditorDocumentContent } from '../editorContentSync'

describe('replaceEditorDocumentContent', () => {
  it('clamps selection when replacing with shorter content', () => {
    const parent = document.createElement('div')
    document.body.appendChild(parent)

    const view = createDiaryCodeMirror(parent, {
      content: 'hello world',
      platform: { resolveAttachmentUrl: (s) => s, interactionMode: 'mouse' }
    })

    view.dispatch({ selection: { anchor: 11, head: 11 } })

    expect(() => {
      replaceEditorDocumentContent(view, 'hi')
    }).not.toThrow()

    expect(view.state.doc.toString()).toBe('hi')
    expect(view.state.selection.main.head).toBe(2)
    expect(view.state.selection.main.anchor).toBe(2)

    view.destroy()
    parent.remove()
  })
})
