import type { EditorView } from '@codemirror/view'
import type { ParsedTable } from './table.model'
import { TableSection, type CellLocation } from './tableSection'
import { setActiveTableCell } from './tableActiveCell'
import { setTableCellEditing } from './tableCellEditing'
import { setTableCellRangeSelection } from './tableRangeSelection'
import { invokeTableAction } from './tableEffects'
import { placeCursorAfterTable } from './tableFocus'
import { findTableToByFrom } from './tableBounds'

export type TableNavigateKey =
  | 'tab'
  | 'shift-tab'
  | 'enter'
  | 'arrow-left'
  | 'arrow-up'
  | 'arrow-right'
  | 'arrow-down'
  | 'shift-arrow-left'
  | 'shift-arrow-up'
  | 'shift-arrow-right'
  | 'shift-arrow-down'

export type TableNavigateContext = {
  tableFrom: number
  tableTo: number
  table: ParsedTable
  activeCell: CellLocation
  anchorCell: CellLocation
  section: TableSection
}

function firstRowIndex(): number {
  return -1
}

function lastRowIndex(table: ParsedTable): number {
  return table.bodyRows.length - 1
}

function lastColIndex(table: ParsedTable): number {
  return table.columnCount - 1
}

function firstCell(): CellLocation {
  return { row: -1, col: 0 }
}

function lastCell(table: ParsedTable): CellLocation {
  return { row: lastRowIndex(table), col: lastColIndex(table) }
}

function cellEquals(a: CellLocation, b: CellLocation): boolean {
  return a.row === b.row && a.col === b.col
}

function shiftLeft(cell: CellLocation): CellLocation {
  return { row: cell.row, col: cell.col - 1 }
}

function shiftRight(cell: CellLocation): CellLocation {
  return { row: cell.row, col: cell.col + 1 }
}

function shiftUp(cell: CellLocation): CellLocation {
  return { row: cell.row - 1, col: cell.col }
}

function shiftDown(cell: CellLocation): CellLocation {
  return { row: cell.row + 1, col: cell.col }
}

function dispatchNavigation(
  view: EditorView,
  tableFrom: number,
  activeCell: CellLocation,
  anchorCell: CellLocation,
  section: TableSection
): void {
  view.dispatch({
    effects: [
      setTableCellEditing.of(null),
      setActiveTableCell.of({
        tableFrom,
        rowIndex: activeCell.row,
        colIndex: activeCell.col
      }),
      setTableCellRangeSelection.of({
        tableFrom,
        anchorRow: anchorCell.row,
        anchorCol: anchorCell.col,
        headRow: activeCell.row,
        headCol: activeCell.col
      })
    ]
  })
}

function moveTo(
  view: EditorView,
  ctx: TableNavigateContext,
  location: CellLocation,
  anchor: CellLocation
): void {
  dispatchNavigation(view, ctx.tableFrom, location, anchor, TableSection.ofCell(location))
}

function moveLeft(
  view: EditorView,
  ctx: TableNavigateContext,
  options: { createRow: boolean }
): void {
  const { table, tableFrom, tableTo, activeCell } = ctx
  if (cellEquals(activeCell, firstCell())) {
    if (!options.createRow) {
      placeCursorAfterTable(view, findTableToByFrom(view.state, tableFrom) ?? tableTo)
      return
    }
    invokeTableAction(view, {
      type: 'addRow',
      tableFrom,
      tableTo,
      atIndex: 0,
      focusAfter: { rowIndex: 0, colIndex: activeCell.col }
    })
    return
  }

  const next =
    activeCell.col === 0
      ? { row: activeCell.row - 1, col: lastColIndex(table) }
      : shiftLeft(activeCell)
  moveTo(view, ctx, next, next)
}

function moveRight(
  view: EditorView,
  ctx: TableNavigateContext,
  options: { createRow: boolean }
): void {
  const { table, tableFrom, tableTo, activeCell } = ctx
  if (cellEquals(activeCell, lastCell(table))) {
    if (!options.createRow) {
      placeCursorAfterTable(view, findTableToByFrom(view.state, tableFrom) ?? tableTo)
      return
    }
    invokeTableAction(view, {
      type: 'addRow',
      tableFrom,
      tableTo,
      atIndex: table.bodyRows.length,
      focusAfter: { rowIndex: table.bodyRows.length, colIndex: 0 }
    })
    return
  }

  const next =
    activeCell.col === lastColIndex(table)
      ? { row: activeCell.row + 1, col: 0 }
      : shiftRight(activeCell)
  moveTo(view, ctx, next, next)
}

function moveUp(
  view: EditorView,
  ctx: TableNavigateContext,
  options: { createRow: boolean }
): void {
  const { table, tableFrom, tableTo, activeCell } = ctx
  if (activeCell.row === firstRowIndex()) {
    if (!options.createRow) {
      placeCursorAfterTable(view, findTableToByFrom(view.state, tableFrom) ?? tableTo)
      return
    }
    invokeTableAction(view, {
      type: 'addRow',
      tableFrom,
      tableTo,
      atIndex: 0,
      focusAfter: { rowIndex: 0, colIndex: activeCell.col }
    })
    return
  }
  moveTo(view, ctx, shiftUp(activeCell), shiftUp(activeCell))
}

function moveDown(
  view: EditorView,
  ctx: TableNavigateContext,
  options: { createRow: boolean }
): void {
  const { table, tableFrom, tableTo, activeCell } = ctx
  if (activeCell.row === lastRowIndex(table)) {
    if (!options.createRow) {
      placeCursorAfterTable(view, findTableToByFrom(view.state, tableFrom) ?? tableTo)
      return
    }
    invokeTableAction(view, {
      type: 'addRow',
      tableFrom,
      tableTo,
      atIndex: table.bodyRows.length,
      focusAfter: { rowIndex: table.bodyRows.length, colIndex: activeCell.col }
    })
    return
  }
  moveTo(view, ctx, shiftDown(activeCell), shiftDown(activeCell))
}

function shiftExpand(view: EditorView, ctx: TableNavigateContext, key: TableNavigateKey): void {
  const { section, anchorCell, activeCell, table } = ctx
  let nextSection = section
  let nextActive = activeCell

  switch (key) {
    case 'shift-arrow-left': {
      if (section.endCol === anchorCell.col) {
        if (section.startCol === 0) return
        nextSection = section.expandLeft()
      } else {
        nextSection = section.contractLeft()
      }
      nextActive = shiftLeft(activeCell)
      break
    }
    case 'shift-arrow-right': {
      if (section.startCol === anchorCell.col) {
        if (section.endCol === lastColIndex(table)) return
        nextSection = section.expandRight()
      } else {
        nextSection = section.contractRight()
      }
      nextActive = shiftRight(activeCell)
      break
    }
    case 'shift-arrow-up': {
      if (section.endRow === anchorCell.row) {
        if (section.startRow === firstRowIndex()) return
        nextSection = section.expandUp()
      } else {
        nextSection = section.contractUp()
      }
      nextActive = shiftUp(activeCell)
      break
    }
    case 'shift-arrow-down': {
      if (section.startRow === anchorCell.row) {
        if (section.endRow === lastRowIndex(table)) return
        nextSection = section.expandDown()
      } else {
        nextSection = section.contractDown()
      }
      nextActive = shiftDown(activeCell)
      break
    }
    default:
      return
  }

  dispatchNavigation(view, ctx.tableFrom, nextActive, anchorCell, nextSection)
}

/** 表格导航模式键盘（对齐 ckant NavigateActions） */
export function runTableNavigateAction(
  view: EditorView,
  ctx: TableNavigateContext,
  key: TableNavigateKey
): boolean {
  switch (key) {
    case 'tab':
      moveRight(view, ctx, { createRow: true })
      return true
    case 'shift-tab':
      moveLeft(view, ctx, { createRow: true })
      return true
    case 'enter':
      moveDown(view, ctx, { createRow: true })
      return true
    case 'arrow-left':
      moveLeft(view, ctx, { createRow: false })
      return true
    case 'arrow-up':
      moveUp(view, ctx, { createRow: false })
      return true
    case 'arrow-right':
      moveRight(view, ctx, { createRow: false })
      return true
    case 'arrow-down':
      moveDown(view, ctx, { createRow: false })
      return true
    case 'shift-arrow-left':
    case 'shift-arrow-right':
    case 'shift-arrow-up':
    case 'shift-arrow-down':
      shiftExpand(view, ctx, key)
      return true
    default:
      return false
  }
}

export function matchTableNavigateKey(event: KeyboardEvent): TableNavigateKey | null {
  if (event.shiftKey && event.key === 'Tab') return 'shift-tab'
  if (!event.shiftKey && event.key === 'Tab') return 'tab'
  if (!event.shiftKey && event.key === 'Enter') return 'enter'
  if (event.shiftKey && event.key === 'ArrowLeft') return 'shift-arrow-left'
  if (event.shiftKey && event.key === 'ArrowRight') return 'shift-arrow-right'
  if (event.shiftKey && event.key === 'ArrowUp') return 'shift-arrow-up'
  if (event.shiftKey && event.key === 'ArrowDown') return 'shift-arrow-down'
  if (!event.shiftKey && event.key === 'ArrowLeft') return 'arrow-left'
  if (!event.shiftKey && event.key === 'ArrowRight') return 'arrow-right'
  if (!event.shiftKey && event.key === 'ArrowUp') return 'arrow-up'
  if (!event.shiftKey && event.key === 'ArrowDown') return 'arrow-down'
  return null
}

export function sectionFromRangeSelection(range: {
  anchorRow: number
  anchorCol: number
  headRow: number
  headCol: number
}): TableSection {
  return TableSection.fromAnchorHead(
    { row: range.anchorRow, col: range.anchorCol },
    { row: range.headRow, col: range.headCol }
  )
}
