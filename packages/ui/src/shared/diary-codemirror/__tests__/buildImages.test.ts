import { describe, it, expect, afterEach } from 'vitest'
import { EditorState } from '@codemirror/state'
import { Decoration, EditorView } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { collectImageDecorations } from '../extensions/buildImages'

describe('collectImageDecorations (C-3 / C-4)', () => {
  let view: EditorView | null = null

  afterEach(() => {
    view?.destroy()
    view = null
  })

  function createView(doc: string) {
    const state = EditorState.create({
      doc,
      extensions: [markdown()]
    })
    view = new EditorView({ state })
    return view
  }

  it('does not widgetize images inside fenced code blocks', () => {
    const editorView = createView(
      '```\n![x](attachment/hidden.png)\n```\n\n![y](attachment/visible.png)'
    )
    const marks: { from: number; to: number; value: Decoration }[] = []
    const ranges = collectImageDecorations(editorView.state, [], undefined, marks)

    expect(ranges).toHaveLength(1)
    expect(editorView.state.doc.sliceString(ranges[0]!.from, ranges[0]!.to)).toBe(
      '![y](attachment/visible.png)'
    )
  })

  it('does not widgetize non-image markdown like video links', () => {
    const editorView = createView('[video](attachment/clip.mp4)\n\n![photo](attachment/photo.png)')
    const marks: { from: number; to: number; value: Decoration }[] = []
    const ranges = collectImageDecorations(editorView.state, [], undefined, marks)

    expect(ranges).toHaveLength(1)
    expect(editorView.state.doc.sliceString(ranges[0]!.from, ranges[0]!.to)).toContain('photo.png')
  })
})
