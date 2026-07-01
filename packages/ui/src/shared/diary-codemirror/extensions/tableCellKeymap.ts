import { EditorView } from '@codemirror/view'
import { Prec, type Extension } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import {
  findTableCellBoundsInLine,
  getTableCellBoundsFromSyntax,
  isTableContentLine
} from './tableCell.utils'
import { TABLE_CELL_LINE_BREAK, tableStructureProtectFilter } from './tableStructureFilter'
import { isTableSeparatorLine } from './buildTable'

function getCellContext(view: EditorView) {
  const { from, to } = view.state.selection.main
  if (from !== to) return null

  const line = view.state.doc.lineAt(from)
  if (isTableSeparatorLine(line.text)) {
    return { kind: 'separator' as const, line }
  }

  const bounds = getTableCellBoundsFromSyntax(view.state, from)
  if (!bounds) return null

  return { kind: 'cell' as const, bounds, line }
}

/** 单元格内换行：插入 <br>，避免拆行破坏表格结构 */
export function insertTableCellLineBreak(view: EditorView): boolean {
  const ctx = getCellContext(view)
  if (!ctx || ctx.kind === 'separator') return false
  if (!ctx.bounds) return false

  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: { from, to, insert: TABLE_CELL_LINE_BREAK },
    selection: { anchor: from + TABLE_CELL_LINE_BREAK.length }
  })
  return true
}

function protectTableDelimiterBackspace(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  if (from !== to) return false

  const line = view.state.doc.lineAt(from)
  if (!isTableContentLine(line.text)) return false

  const bounds = getTableCellBoundsFromSyntax(view.state, from)
  if (!bounds) return false

  if (from <= bounds.from) return true

  const prevChar = view.state.doc.sliceString(from - 1, from)
  if (prevChar === '|') return true

  return false
}

function protectTableDelimiterDelete(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  if (from !== to) return false

  const line = view.state.doc.lineAt(from)
  if (!isTableContentLine(line.text)) return false

  const bounds = getTableCellBoundsFromSyntax(view.state, from)
  if (!bounds) return false

  const nextChar = view.state.doc.sliceString(from, from + 1)
  if (nextChar === '|') return true

  if (from >= bounds.to) return true

  return false
}

function handleTableEnter(view: EditorView): boolean {
  return insertTableCellLineBreak(view)
}

function handleTableBackspace(view: EditorView): boolean {
  return protectTableDelimiterBackspace(view)
}

function handleTableDelete(view: EditorView): boolean {
  return protectTableDelimiterDelete(view)
}

function handleTableBeforeInput(event: InputEvent, view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  if (from !== to) return false

  const line = view.state.doc.lineAt(from)

  if (event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph') {
    if (isTableSeparatorLine(line.text)) {
      event.preventDefault()
      return true
    }
    if (findTableCellBoundsInLine(line, from) || getTableCellBoundsFromSyntax(view.state, from)) {
      if (handleTableEnter(view)) {
        event.preventDefault()
        return true
      }
    }
    return false
  }

  if (event.inputType === 'deleteContentBackward') {
    if (handleTableBackspace(view)) {
      event.preventDefault()
      return true
    }
    return false
  }

  if (event.inputType === 'deleteContentForward') {
    if (handleTableDelete(view)) {
      event.preventDefault()
      return true
    }
    return false
  }

  return false
}

export const tableCellKeymap = keymap.of([
  { key: 'Enter', run: handleTableEnter },
  { key: 'Shift-Enter', run: handleTableEnter },
  { key: 'Backspace', run: handleTableBackspace },
  { key: 'Delete', run: handleTableDelete }
])

export const tableCellInputHandler = EditorView.domEventHandlers({
  beforeinput(event, view) {
    if (!(event instanceof InputEvent)) return false
    return handleTableBeforeInput(event, view)
  }
})

export const tableCellExtension: Extension = [
  tableStructureProtectFilter,
  Prec.highest(tableCellKeymap),
  Prec.highest(tableCellInputHandler)
]
