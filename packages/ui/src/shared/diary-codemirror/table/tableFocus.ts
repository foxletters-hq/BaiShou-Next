import type { EditorView } from '@codemirror/view'

export function focusTableCellInEditor(
  view: EditorView,
  tableFrom: number,
  rowIndex: number,
  colIndex: number
): boolean {
  const cell = view.dom.querySelector(
    `.cm-table-block[data-table-from="${tableFrom}"] [data-row="${rowIndex}"][data-col="${colIndex}"]`
  ) as HTMLElement | null
  if (!cell) return false

  cell.focus()
  const range = document.createRange()
  const sel = window.getSelection()
  range.selectNodeContents(cell)
  range.collapse(false)
  sel?.removeAllRanges()
  sel?.addRange(range)
  return true
}
