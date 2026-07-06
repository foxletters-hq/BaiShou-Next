import type { EditorState } from '@codemirror/state'
import { isCursorInRange } from './cursor'
import { listMarkerReplaceSpec } from './styles'
import { pushReplaceDecoration, type DecorationMark } from './decorationMarks'

const BULLET_LINE_RE = /^(\s*)([-*+])\s/

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
    const match = line.text.match(BULLET_LINE_RE)
    if (!match) continue

    const indent = match[1] ?? ''
    const markerStart = line.from + indent.length
    const markerEnd = markerStart + 2

    if (isCursorInRange(markerStart, markerEnd, cursors)) continue

    pushReplaceDecoration(marks, doc, markerStart, markerEnd, listMarkerReplaceSpec)
  }
}
