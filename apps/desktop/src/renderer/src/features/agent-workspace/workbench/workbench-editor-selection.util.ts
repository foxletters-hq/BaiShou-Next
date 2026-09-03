import type { EditorView } from '@codemirror/view'

export type WorkbenchEditorLineRange = {
  startLine: number
  endLine: number
}

export type WorkbenchActiveSelection = WorkbenchEditorLineRange & {
  relativePath: string
}

export function normalizeEditorLineRange(
  startLine: number,
  endLine: number
): WorkbenchEditorLineRange {
  return {
    startLine: Math.min(startLine, endLine),
    endLine: Math.max(startLine, endLine)
  }
}

export function selectionLinesFromOffsets(
  from: number,
  to: number,
  lineAt: (pos: number) => number
): WorkbenchEditorLineRange | null {
  if (from === to) return null
  // CodeMirror 的 `to` 是开区间。选到下一行行首时，不应把下一行算进范围。
  return normalizeEditorLineRange(lineAt(from), lineAt(Math.max(from, to - 1)))
}

export function getEditorViewSelectionLines(
  view: EditorView | null | undefined
): WorkbenchEditorLineRange | null {
  if (!view) return null
  if (view.state.selection.ranges.length !== 1) return null
  const { from, to } = view.state.selection.main
  return selectionLinesFromOffsets(from, to, (pos) => view.state.doc.lineAt(pos).number)
}

export type WorkbenchEditorSelectionHandle = {
  getSelectionLines: () => WorkbenchEditorLineRange | null
}
