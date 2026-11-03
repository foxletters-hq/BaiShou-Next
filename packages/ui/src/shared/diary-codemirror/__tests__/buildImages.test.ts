import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { Decoration } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { collectImageDecorations, scanImageRanges } from '../extensions/buildImages'
import { buildMarkerHidingDecorations } from '../extensions/build'
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

  it('keeps ImageWidget for all images in buildMarkerHidingDecorations without splitting into link marks', () => {
    const doc = [
      '![img_1_with_underscore](attachment/img_1.png)',
      ...Array.from({ length: 30 }, (_, i) => `paragraph ${i}`),
      '![img_2_with_underscore](attachment/img_2.png)',
      ...Array.from({ length: 30 }, (_, i) => `paragraph ${i + 30}`),
      '![img_3_with_underscore](attachment/img_3.png)'
    ].join('\n')
    const state = createState(doc)
    const deco = buildMarkerHidingDecorations(
      state,
      { resolveAttachmentUrl: (u) => `local:///${u}`, interactionMode: 'touch' },
      { hasFocus: false }
    )

    const imageWidgets: ImageWidget[] = []
    let linkMarkCount = 0
    deco.between(0, state.doc.length, (_from, _to, value) => {
      if (value.spec.widget instanceof ImageWidget) {
        imageWidgets.push(value.spec.widget)
      }
      if (value.spec.class === 'cm-rendered-link' || value.spec.class === 'cm-link') {
        linkMarkCount += 1
      }
    })

    expect(imageWidgets).toHaveLength(3)
    expect(linkMarkCount).toBe(0)
  })
})
