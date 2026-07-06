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
import { allowTableStructureEdit } from './tableEffects'

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

function docTailSnippet(doc: Text | string, max = 48): string {
  const text = typeof doc === 'string' ? doc : doc.toString()
  if (text.length <= max) return JSON.stringify(text)
  return JSON.stringify(`…${text.slice(-max)}`)
}

export function placeCursorAfterTable(view: EditorView, tableRowTo: number): void {
  blurTableCellEditor()

  const preDocLen = view.state.doc.length
  const preHead = view.state.selection.main.head
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

  const { cursor: resolvedCursor, change } = resolvePostTableCursor(
    EditorState.create({ doc: text }).doc,
    rowTo
  )
  if (change) {
    text = text.slice(0, change.from) + change.insert + text.slice(change.from)
  }
  const finalCursor = clampPosToDoc(resolvedCursor, text.length)
  const effects = clearActiveTableCellEffects(view.state)

  const replacement = computeSingleTextReplacement(original, text)
  logDiaryBridge('tableFocus', 'placeCursorAfterTable:pre', {
    tableRowTo,
    rowToAfterSeparator: rowTo,
    preDocLen,
    preHead,
    computedTextLen: text.length,
    resolvedCursor,
    finalCursor,
    hadSeparator: !!separatorChange,
    separatorFrom: separatorChange?.from ?? null,
    separatorInsertLen: separatorChange?.insert.length ?? 0,
    hadGapChange: !!change,
    gapFrom: change?.from ?? null,
    gapInsertLen: change?.insert.length ?? 0,
    textChanged: original !== text,
    willApplyReplacement: !!replacement,
    tailBefore: docTailSnippet(original),
    tailAfter: docTailSnippet(text)
  })

  const dispatchSpec = {
    selection: EditorSelection.cursor(finalCursor),
    effects,
    scrollIntoView: false as const,
    annotations: allowTableStructureEdit.of(true)
  }

  if (!replacement) {
    view.dispatch(dispatchSpec)
  } else {
    view.dispatch({
      ...dispatchSpec,
      changes: replacement
    })
  }

  view.focus()

  const postDocLen = view.state.doc.length
  const postHead = view.state.selection.main.head
  logDiaryBridge('tableFocus', 'placeCursorAfterTable', {
    tableRowTo,
    cursor: finalCursor,
    preDocLen,
    postDocLen,
    preHead,
    postHead,
    docLength: postDocLen,
    docDelta: postDocLen - preDocLen,
    hadSeparator: !!separatorChange,
    hadGapChange: !!change,
    appliedReplacement: !!replacement,
    replacementFrom: replacement?.from ?? null,
    replacementTo: replacement?.to ?? null,
    replacementInsertLen: replacement?.insert.length ?? 0,
    selectionOnly: !replacement,
    tailAfterDispatch: docTailSnippet(view.state.doc)
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
    return focusTableCellSourceAtPoint(block, rowIndex, colIndex, options.clientX, options.clientY)
  }
  return focusTableCellSource(block, rowIndex, colIndex, false)
}

export function blurTableCellInput(): void {
  blurTableCellEditor()
}
