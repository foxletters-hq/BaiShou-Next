import { EditorSelection, EditorState, type Text } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { clearActiveTableCellEffects } from './tableActiveCell'
import { blurTableCellEditor, focusTableCellSource } from './tableDom'
import { logDiaryBridge } from '../diaryBridgeDebug'
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
  blurTableCellEditor()

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
    effects: clearActiveTableCellEffects(view.state),
    scrollIntoView: false
  })

  // 必须在用户手势内同步 focus，否则 iOS WebView 不弹键盘；滚动延后单独处理
  view.focus()

  logDiaryBridge('tableFocus', 'placeCursorAfterTable', {
    tableRowTo,
    cursor: mapPosToOriginal(cursor),
    docLength: doc.length,
    hadSeparator: !!separatorChange,
    hadGapChange: !!change
  })

  const afterPlace = window.__diaryCmPlaceCursorAfterTable
  if (typeof afterPlace === 'function') {
    afterPlace(view)
  }
}

export function focusTableCellInEditor(
  view: EditorView,
  tableFrom: number,
  rowIndex: number,
  colIndex: number,
  _selection?: { start: number; end: number }
): boolean {
  const block = view.dom.querySelector(
    `.cm-table-block[data-table-from="${tableFrom}"]`
  ) as HTMLElement | null
  if (!block) return false
  return focusTableCellSource(block, rowIndex, colIndex)
}

export function blurTableCellInput(): void {
  blurTableCellEditor()
}
