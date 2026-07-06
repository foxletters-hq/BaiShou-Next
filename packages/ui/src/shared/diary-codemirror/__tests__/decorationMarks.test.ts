import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { Decoration } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { ensureSyntaxTree } from '@codemirror/language'
import {
  buildSafeDecorationSet,
  isReplaceDecoration,
  pushReplaceDecoration
} from '../extensions/decorationMarks'
import { hideSyntaxEmptyReplace } from '../extensions/styles'
import { buildMarkerHidingDecorations } from '../extensions/build'

describe('decorationMarks', () => {
  it('treats empty Decoration.replace as replace, not mark', () => {
    expect(isReplaceDecoration(hideSyntaxEmptyReplace)).toBe(true)
  })

  it('buildSafeDecorationSet accepts empty replace without throwing', () => {
    const state = EditorState.create({ doc: '**bold**\n', extensions: [markdown()] })
    const marks: { from: number; to: number; value: Decoration }[] = []
    pushReplaceDecoration(marks, state.doc, 0, 2, {})
    pushReplaceDecoration(marks, state.doc, 6, 8, {})
    expect(() => buildSafeDecorationSet(marks)).not.toThrow()
    const deco = buildSafeDecorationSet(marks)
    let replaceCount = 0
    deco.between(0, state.doc.length, () => {
      replaceCount += 1
    })
    expect(replaceCount).toBe(2)
  })

  it('splits multiline replace into per-line segments', () => {
    const state = EditorState.create({ doc: 'a\nb\nc', extensions: [markdown()] })
    const marks: { from: number; to: number; value: Decoration }[] = []
    pushReplaceDecoration(marks, state.doc, 0, 4, {})
    expect(marks.length).toBe(2)
    expect(marks[0]!.from).toBe(0)
    expect(marks[0]!.to).toBe(1)
    expect(marks[1]!.from).toBe(2)
    expect(marks[1]!.to).toBe(3)
  })

  it('mouse mode diary content survives selection changes without throw', () => {
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
    const state = EditorState.create({
      doc: content,
      selection: { anchor: 0, head: 0 },
      extensions: [markdown()]
    })
    ensureSyntaxTree(state, state.doc.length, 200)
    const platform = { resolveAttachmentUrl: (u: string) => u, interactionMode: 'mouse' as const }
    const positions = [0, content.indexOf('dqw'), content.indexOf('quoted'), content.length - 1]
    for (const pos of positions) {
      const next = state.update({ selection: { anchor: pos, head: pos } })
      expect(() =>
        buildMarkerHidingDecorations(next.state, platform, { hasFocus: true })
      ).not.toThrow()
    }
  })
})
