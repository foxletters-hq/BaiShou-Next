import type { EditorView } from '@codemirror/view'

export function getCursorPositions(view: EditorView): number[] {
  return view.state.selection.ranges.map((r) => r.head)
}

/** CodeMirror 文档位置区间：from 含，to 不含 */
export function isCursorInRange(from: number, to: number, cursors: number[]): boolean {
  return cursors.some((c) => c >= from && c < to)
}

export function isCursorOnLine(lineFrom: number, lineTo: number, cursors: number[]): boolean {
  return cursors.some((c) => c >= lineFrom && c <= lineTo)
}
