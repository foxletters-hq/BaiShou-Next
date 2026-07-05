import type { EditorState } from '@codemirror/state'
import type { Decoration } from '@codemirror/view'
import { isCursorInRange } from './cursor'
import { listMarkerReplace } from './styles'

const BULLET_LINE_RE = /^(\s*)([-*+])\s/

type DecorationMark = { from: number; to: number; value: Decoration }

function pushDecoration(
  marks: DecorationMark[],
  value: Decoration,
  from: number,
  to: number
): void {
  if (from < to) marks.push(value.range(from, to))
}

/** 基于行文本渲染列表圆点（不依赖语法树解析时机） */
export function collectListLineDecorations(
  state: EditorState,
  cursors: number[],
  marks: DecorationMark[]
): void {
  const doc = state.doc

  for (let lineNum = 1; lineNum <= doc.lines; lineNum += 1) {
    const line = doc.line(lineNum)
    const match = line.text.match(BULLET_LINE_RE)
    if (!match) continue

    const indent = match[1] ?? ''
    const markerStart = line.from + indent.length
    const markerEnd = markerStart + 2 // `-` + 空格

    if (isCursorInRange(markerStart, markerEnd, cursors)) continue

    pushDecoration(marks, listMarkerReplace, markerStart, markerEnd)
  }
}
