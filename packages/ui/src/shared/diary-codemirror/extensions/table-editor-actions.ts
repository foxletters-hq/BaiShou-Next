import { EditorView } from '@codemirror/view'
import type { StateEffect } from '@codemirror/state'
import {
  addTableColumnMarkdown,
  addTableRowMarkdown,
  deleteTableColumnMarkdown,
  deleteTableRowMarkdown,
  moveTableColumnMarkdown,
  moveTableRowMarkdown,
  updateTableCellMarkdown
} from '../table/table.ops'
import {
  allowTableStructureEdit,
  forceTableRefresh,
  pendingTableCellFocus,
  type TableCellFocusTarget,
  type TableEditorAction
} from '../table/tableEffects'
import { findTableNodeBounds } from '../table/tableBounds'
import { clearActiveTableCellEffects, setActiveTableCell } from '../table/tableActiveCell'
import { setTableCellEditing } from '../table/tableCellEditing'
import {
  desktopTableInteractionField,
  setDesktopTableInteraction
} from '../table/desktop/tableInteractionField'
import { DesktopTableSection } from '../table/desktop/models/desktopTableSection'
import { parsedRowToDomRow } from '../table/desktop/models/cellLocation'
import { ensureTableMarkdownTrailingNewline } from '../table/tableFocus'

export function isDesktopTableEditor(state: import('@codemirror/state').EditorState): boolean {
  return state.field(desktopTableInteractionField, false) !== undefined
}

export function buildTableCellFocusEffects(
  state: import('@codemirror/state').EditorState,
  tableFrom: number,
  rowIndex: number,
  colIndex: number,
  extra?: {
    selectionStart?: number
    selectionEnd?: number
    placeAtEnd?: boolean
    initialInsertText?: string
  }
): StateEffect<unknown>[] {
  const focus = pendingTableCellFocus.of({
    tableFrom,
    rowIndex,
    colIndex,
    ...extra
  })
  if (isDesktopTableEditor(state)) {
    const domRow = parsedRowToDomRow(rowIndex)
    const cell = { row: domRow, col: colIndex }
    return [
      setDesktopTableInteraction.of({
        tableFrom,
        activeCell: cell,
        anchorCell: cell,
        outlinedSection: DesktopTableSection.ofCell(cell),
        mode: 'cell'
      }),
      focus
    ]
  }
  return [
    setActiveTableCell.of({ tableFrom, rowIndex, colIndex }),
    setTableCellEditing.of({ tableFrom, rowIndex, colIndex }),
    focus
  ]
}

export function clearTableInteractionEffects(
  state: import('@codemirror/state').EditorState
): StateEffect<unknown>[] {
  if (isDesktopTableEditor(state)) {
    return [setDesktopTableInteraction.of(null)]
  }
  return clearActiveTableCellEffects(state)
}

export function resolveTableReplaceRange(
  state: import('@codemirror/state').EditorState,
  pipeTableFrom: number,
  pipeTableTo: number
): { from: number; to: number } {
  const bounds = findTableNodeBounds(state, pipeTableFrom)
  if (bounds) return { from: bounds.nodeFrom, to: bounds.nodeTo }
  return { from: pipeTableFrom, to: pipeTableTo }
}

export function applyTableMarkdown(
  view: EditorView,
  tableFrom: number,
  tableTo: number,
  nextMarkdown: string | null,
  focusAfter?: TableCellFocusTarget
): void {
  if (!nextMarkdown) return
  const range = resolveTableReplaceRange(view.state, tableFrom, tableTo)
  const markdown = ensureTableMarkdownTrailingNewline(view.state.doc, range.to, nextMarkdown)
  const effects: StateEffect<unknown>[] = [forceTableRefresh.of(null)]
  if (focusAfter) {
    effects.push(
      ...buildTableCellFocusEffects(
        view.state,
        tableFrom,
        focusAfter.rowIndex,
        focusAfter.colIndex,
        {
          selectionStart: focusAfter.selectionStart,
          selectionEnd: focusAfter.selectionEnd
        }
      )
    )
  }
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: markdown },
    effects,
    annotations: allowTableStructureEdit.of(true)
  })
}

export function handleTableAction(view: EditorView, action: TableEditorAction): void {
  const bounds = findTableNodeBounds(view.state, action.tableFrom)
  if (!bounds) return
  const table = bounds.table

  switch (action.type) {
    case 'updateCell': {
      const next = updateTableCellMarkdown(table, action.rowIndex, action.colIndex, action.value)
      const range = resolveTableReplaceRange(view.state, table.from, table.to)
      const unchanged = !next || next === view.state.doc.sliceString(range.from, range.to)
      if (unchanged) {
        if (action.focusAfter) {
          view.dispatch({
            effects: buildTableCellFocusEffects(
              view.state,
              table.from,
              action.focusAfter.rowIndex,
              action.focusAfter.colIndex,
              {
                selectionStart: action.focusAfter.selectionStart,
                selectionEnd: action.focusAfter.selectionEnd
              }
            )
          })
        }
        return
      }
      applyTableMarkdown(view, table.from, table.to, next, action.focusAfter)
      return
    }
    case 'addColumn': {
      const atIndex = action.atIndex ?? table.columnCount
      const focusAfter = action.focusAfter ?? { rowIndex: -1, colIndex: atIndex }
      applyTableMarkdown(
        view,
        table.from,
        table.to,
        addTableColumnMarkdown(table, atIndex),
        focusAfter
      )
      return
    }
    case 'addRow': {
      const atIndex = action.atIndex ?? table.bodyRows.length
      const focusAfter = action.focusAfter ?? { rowIndex: atIndex, colIndex: 0 }
      applyTableMarkdown(
        view,
        table.from,
        table.to,
        addTableRowMarkdown(table, atIndex, action.templateRow),
        focusAfter
      )
      return
    }
    case 'deleteTable': {
      const range = resolveTableReplaceRange(view.state, table.from, table.to)
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: '' },
        effects: [forceTableRefresh.of(null), ...clearTableInteractionEffects(view.state)],
        selection: { anchor: range.from },
        annotations: allowTableStructureEdit.of(true)
      })
      return
    }
    case 'deleteColumn':
      applyTableMarkdown(
        view,
        table.from,
        table.to,
        deleteTableColumnMarkdown(table, action.colIndex)
      )
      return
    case 'deleteRow':
      applyTableMarkdown(view, table.from, table.to, deleteTableRowMarkdown(table, action.rowIndex))
      return
    case 'moveColumn':
      applyTableMarkdown(
        view,
        table.from,
        table.to,
        moveTableColumnMarkdown(table, action.fromIndex, action.toIndex)
      )
      return
    case 'moveRow':
      applyTableMarkdown(
        view,
        table.from,
        table.to,
        moveTableRowMarkdown(table, action.fromIndex, action.toIndex)
      )
      return
    default:
      return
  }
}
