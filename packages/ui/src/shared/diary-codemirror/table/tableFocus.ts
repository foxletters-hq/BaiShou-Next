import { EditorSelection, EditorState, type Text } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { setActiveTableCell } from './tableActiveCell'
import { resolvePostTableCursor, postTableSeparatorChange } from './tablePostGap'

/** 结构变更写入时，若表后缺少换行则补一个 */
export function ensureTableMarkdownTrailingNewline(doc: Text, tableTo: number, markdown: string): string {
  if (tableTo >= doc.length) {
    return markdown.endsWith('\n') ? markdown : `${markdown}\n`
  }
  const after = doc.sliceString(tableTo, tableTo + 1)
  if (after === '\n') {
    return markdown
  }
  return `${markdown}\n`
}

declare global {
  interface Window {
    __diaryCmPlaceCursorAfterTable?: (view: EditorView) => void
  }
}

export function placeCursorAfterTable(view: EditorView, tableRowTo: number): void {
  const doc = view.state.doc
  const separatorChange = postTableSeparatorChange(doc, tableRowTo)
  let workingDoc = doc
  let workingRowTo = tableRowTo
  const separatorInsertLen = separatorChange?.insert.length ?? 0
  if (separatorChange) {
    const next =
      doc.sliceString(0, separatorChange.from) +
      separatorChange.insert +
      doc.sliceString(separatorChange.from)
    workingDoc = EditorState.create({ doc: next }).doc
    if (separatorChange.from <= tableRowTo) {
      workingRowTo += separatorInsertLen
    }
  }
  const mapPosToOriginal = (pos: number): number => {
    if (separatorChange && pos > separatorChange.from) {
      return pos - separatorInsertLen
    }
    return pos
  }
  const { cursor, change } = resolvePostTableCursor(workingDoc, workingRowTo)
  const changes = []
  if (separatorChange) changes.push(separatorChange)
  if (change) changes.push({ from: mapPosToOriginal(change.from), insert: change.insert })

  view.dispatch({
    ...(changes.length ? { changes } : {}),
    selection: EditorSelection.cursor(mapPosToOriginal(cursor)),
    effects: setActiveTableCell.of(null),
    scrollIntoView: false
  })

  const afterPlace = window.__diaryCmPlaceCursorAfterTable
  if (typeof afterPlace === 'function') {
    afterPlace(view)
    return
  }
  view.focus()
}

export function focusTableCellInEditor(
  view: EditorView,
  tableFrom: number,
  rowIndex: number,
  colIndex: number,
  selection?: { start: number; end: number }
): boolean {
  const input = view.dom.querySelector(
    `.cm-table-block[data-table-from="${tableFrom}"] textarea.cm-table-cell-input[data-row="${rowIndex}"][data-col="${colIndex}"]`
  ) as HTMLTextAreaElement | null
  if (!input) return false

  input.focus()
  const end = input.value.length
  const start = selection?.start ?? end
  const selEnd = selection?.end ?? end
  input.setSelectionRange(Math.min(start, end), Math.min(selEnd, end))
  return true
}

export function blurTableCellInput(): void {
  const active = document.activeElement
  if (active instanceof HTMLTextAreaElement && active.classList.contains('cm-table-cell-input')) {
    active.blur()
  }
}
