import { EditorSelection, EditorState, type Text } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { clampPosToDoc } from '../editorContentSync'
import { clearActiveTableCellEffects } from './tableActiveCell'
import { blurTableCellEditor, focusTableCellSource, focusTableCellSourceAtPoint } from './tableDom'
import { focusNestedTableCellEditor } from './tableWidgetSync'
import { focusDesktopCellEditor } from './desktop/sync/desktopTableSync'
import { parsedRowToDomRow } from './desktop/models/cellLocation'
import { logDiaryBridge } from '../diaryBridgeDebug'
import { resolvePostTableCursor, postTableSeparatorChange } from './tablePostGap'

/** 结构变更写入时，若表后缺少换行则补一个 */
export function ensureTableMarkdownTrailingNewline(
  doc: Text,
  tableTo: number,
  markdown: string
): string {
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
  blurTableCellEditor()

  const original = view.state.doc.toString()
  let text = original
  let rowTo = tableRowTo

  const separatorChange = postTableSeparatorChange(view.state.doc, tableRowTo)
  if (separatorChange) {
    text =
      text.slice(0, separatorChange.from) +
      separatorChange.insert +
      text.slice(separatorChange.from)
    if (separatorChange.from <= rowTo) {
      rowTo += separatorChange.insert.length
    }
  }

  const { cursor, change } = resolvePostTableCursor(EditorState.create({ doc: text }).doc, rowTo)
  if (change) {
    text = text.slice(0, change.from) + change.insert + text.slice(change.from)
  }
  const finalCursor = clampPosToDoc(cursor, text.length)
  const effects = clearActiveTableCellEffects(view.state)

  const replacement = computeSingleTextReplacement(original, text)
  if (!replacement) {
    view.dispatch({
      selection: EditorSelection.cursor(finalCursor),
      effects,
      scrollIntoView: false
    })
  } else {
    view.dispatch({
      changes: replacement,
      selection: EditorSelection.cursor(finalCursor),
      effects,
      scrollIntoView: false
    })
  }

  view.focus()

  logDiaryBridge('tableFocus', 'placeCursorAfterTable', {
    tableRowTo,
    cursor: finalCursor,
    docLength: view.state.doc.length,
    hadSeparator: !!separatorChange,
    hadGapChange: !!change
  })

  const afterPlace = window.__diaryCmPlaceCursorAfterTable
  if (typeof afterPlace === 'function') {
    afterPlace(view)
  }
}

function computeSingleTextReplacement(
  original: string,
  updated: string
): { from: number; to: number; insert: string } | null {
  if (original === updated) return null
  let from = 0
  while (from < original.length && from < updated.length && original[from] === updated[from]) {
    from += 1
  }
  let origTo = original.length
  let updTo = updated.length
  while (origTo > from && updTo > from && original[origTo - 1] === updated[updTo - 1]) {
    origTo -= 1
    updTo -= 1
  }
  return { from, to: origTo, insert: updated.slice(from, updTo) }
}

export function focusTableCellInEditor(
  view: EditorView,
  tableFrom: number,
  rowIndex: number,
  colIndex: number,
  options?: { selectionStart?: number; selectionEnd?: number; clientX?: number; clientY?: number }
): boolean {
  const block = view.dom.querySelector(
    `.cm-table-block[data-table-from="${tableFrom}"]`
  ) as HTMLElement | null
  if (!block) return false
  const isDesktop = block.dataset.interactionMode === 'mouse'
  if (isDesktop) {
    const domRow = parsedRowToDomRow(rowIndex)
    if (
      focusDesktopCellEditor(block, domRow, colIndex, {
        clientX: options?.clientX,
        clientY: options?.clientY,
        placeAtEnd: options?.clientX == null && options?.clientY == null
      })
    ) {
      return true
    }
    return false
  }
  if (
    focusNestedTableCellEditor(block, rowIndex, colIndex, {
      clientX: options?.clientX,
      clientY: options?.clientY,
      placeAtEnd: options?.clientX == null && options?.clientY == null
    })
  ) {
    return true
  }
  if (options?.clientX != null && options?.clientY != null) {
    return focusTableCellSourceAtPoint(
      block,
      rowIndex,
      colIndex,
      options.clientX,
      options.clientY
    )
  }
  return focusTableCellSource(block, rowIndex, colIndex, false)
}

export function blurTableCellInput(): void {
  blurTableCellEditor()
}
