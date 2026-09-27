import type { EditorState } from '@codemirror/state'
import { pushReplaceDecoration, type DecorationMark } from './decorationMarks'
import { hideSyntaxReplaceSpec, renderedLinkMark } from './styles'
import {
  markdownInlineLinkDestination,
  selectionTouchesLinkRange
} from './markdown-link-preview.util'

/** 语法树没标出 Link 时，仍按行把 `[文字](网址)` 收成超链接。图片不处理。 */
const INLINE_LINK_RE = /(?<!!)\[([^\]\n]+)\]\(([^)\n]+)\)/g

export function collectInlineLinkLineDecorations(
  state: EditorState,
  cursors: number[],
  marks: DecorationMark[],
  skipLineNumbers?: Set<number>,
  touchMode = false
): void {
  const doc = state.doc
  const hideSpec = hideSyntaxReplaceSpec(touchMode)

  for (let lineNum = 1; lineNum <= doc.lines; lineNum += 1) {
    if (skipLineNumbers?.has(lineNum)) continue
    const line = doc.line(lineNum)
    INLINE_LINK_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = INLINE_LINK_RE.exec(line.text))) {
      const from = line.from + match.index
      const to = from + match[0].length
      const labelFrom = from + 1
      const labelTo = labelFrom + (match[1]?.length ?? 0)
      if (
        selectionTouchesLinkRange(
          cursors.map((cursor) => ({ from: cursor, to: cursor })),
          from,
          to
        )
      ) {
        continue
      }
      if (labelTo <= labelFrom || labelTo >= to) continue
      const href = markdownInlineLinkDestination(match[0])
      if (!href) continue
      pushReplaceDecoration(marks, doc, from, labelFrom, hideSpec)
      pushReplaceDecoration(marks, doc, labelTo, to, hideSpec)
      const alreadyMarked = marks.some(
        (item) =>
          item.from === labelFrom &&
          item.to === labelTo &&
          item.value.spec.class === 'cm-rendered-link'
      )
      if (!alreadyMarked) marks.push(renderedLinkMark(href).range(labelFrom, labelTo))
    }
  }
}
