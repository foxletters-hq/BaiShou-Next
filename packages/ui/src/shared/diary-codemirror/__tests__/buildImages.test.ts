import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { Decoration } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { collectImageDecorations, scanImageRanges } from '../extensions/buildImages'
import { ImagePlaceholderWidget } from '../widgets/ImagePlaceholderWidget'
import { ImageWidget } from '../widgets/ImageWidget'

describe('collectImageDecorations (C-3 / C-4)', () => {
  function createState(doc: string) {
    return EditorState.create({
      doc,
      extensions: [markdown()]
    })
  }

  it('does not widgetize images inside fenced code blocks', () => {
    const state = createState(
      '```\n![x](attachment/hidden.png)\n```\n\n![y](attachment/visible.png)'
    )
    const marks: { from: number; to: number; value: Decoration }[] = []
    const ranges = collectImageDecorations(state, [], undefined, marks)

    expect(ranges).toHaveLength(1)
    expect(state.doc.sliceString(ranges[0]!.from, ranges[0]!.to)).toBe(
      '![y](attachment/visible.png)'
    )
  })

  it('does not widgetize non-image markdown like video links', () => {
    const state = createState('[video](attachment/clip.mp4)\n\n![photo](attachment/photo.png)')
    const marks: { from: number; to: number; value: Decoration }[] = []
    const ranges = collectImageDecorations(state, [], undefined, marks)

    expect(ranges).toHaveLength(1)
    expect(state.doc.sliceString(ranges[0]!.from, ranges[0]!.to)).toContain('photo.png')
  })

  it('uses placeholder widgets for off-screen images when viewport ranges are set', () => {
    const lines = Array.from({ length: 40 }, (_, i) =>
      i === 0 ? '![top](attachment/top.png)' : `line ${i}`
    )
    lines.push('![bottom](attachment/bottom.png)')
    const state = createState(lines.join('\n'))
    const bottomRange = scanImageRanges(state).find((range) =>
      state.doc.sliceString(range.from, range.to).includes('bottom.png')
    )
    expect(bottomRange).toBeDefined()

    const marks: { from: number; to: number; value: Decoration }[] = []
    collectImageDecorations(state, [], undefined, marks, {
      visibleRanges: [{ from: 0, to: state.doc.line(3).to }],
      offscreenPlaceholder: true
    })

    const widgets = marks.map((mark) => mark.value.spec.widget)
    expect(widgets.some((widget) => widget instanceof ImageWidget)).toBe(true)
    expect(widgets.some((widget) => widget instanceof ImagePlaceholderWidget)).toBe(true)
    expect(
      marks.some(
        (mark) =>
          mark.from === bottomRange!.from &&
          mark.value.spec.widget instanceof ImagePlaceholderWidget
      )
    ).toBe(true)
  })
})
