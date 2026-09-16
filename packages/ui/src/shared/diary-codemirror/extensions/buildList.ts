import type { EditorState } from '@codemirror/state'
import { isCursorInRange } from './cursor'
import { listMarkerReplaceSpec, listNumberMark, orderedListLineStyle } from './styles'
import { pushLineDecoration, pushReplaceDecoration, type DecorationMark } from './decorationMarks'

const BULLET_LINE_RE = /^(\s*)([-*+])\s/
const ORDERED_LINE_RE = /^(\s*)(\d+)\.\s/

export function collectListLineDecorations(
  state: EditorState,
  cursors: number[],
  marks: DecorationMark[],
  skipLineNumbers?: Set<number>
): void {
  const doc = state.doc

  for (let lineNum = 1; lineNum <= doc.lines; lineNum += 1) {
    if (skipLineNumbers?.has(lineNum)) continue
    const line = doc.line(lineNum)

    const ordered = line.text.match(ORDERED_LINE_RE)
    if (ordered) {
      pushLineDecoration(marks, orderedListLineStyle, line.from)
      const indent = ordered[1] ?? ''
      const digits = ordered[2] ?? ''
      const markerStart = line.from + indent.length
      const markerEnd = markerStart + digits.length + 1
      if (markerStart < markerEnd) {
        marks.push(listNumberMark.range(markerStart, markerEnd))
      }
      continue
    }

    const match = line.text.match(BULLET_LINE_RE)
    if (!match) continue

    const indent = match[1] ?? ''
    const markerStart = line.from + indent.length
    const markerEnd = markerStart + 2

    if (isCursorInRange(markerStart, markerEnd, cursors)) continue

    pushReplaceDecoration(marks, doc, markerStart, markerEnd, listMarkerReplaceSpec)
  }
}
