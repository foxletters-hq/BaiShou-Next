import type { EditorView } from '@codemirror/view'
import type { ParsedTable } from '../../table.model'
import type { CellLocation } from '../models/cellLocation'
import { DesktopTableSection } from '../models/desktopTableSection'
import { setDesktopTableInteraction } from '../tableInteractionField'
import { invokeTableAction } from '../../tableEffects'
import { findTableToByFrom } from '../../tableBounds'
import { placeCursorAfterTable } from '../../tableFocus'

export type DesktopNavigateKey =
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

function dispatchMove(
  view: EditorView,
  tableFrom: number,
  active: CellLocation,
  anchor: CellLocation,
  section: DesktopTableSection,
  mode: 'hidden' | 'cell' = 'hidden'
): void {
  view.dispatch({
    effects: [
      setDesktopTableInteraction.of({
        tableFrom,
        activeCell: active,
        anchorCell: anchor,
        outlinedSection: section,
        mode
      })
    ]
  })
}

function moveTo(view: EditorView, tableFrom: number, cell: CellLocation): void {
  dispatchMove(view, tableFrom, cell, cell, DesktopTableSection.ofCell(cell))
}

export function runDesktopNavigate(
  view: EditorView,
  tableFrom: number,
  tableTo: number,
  table: ParsedTable,
  interaction: {
    activeCell: CellLocation
    anchorCell: CellLocation
    outlinedSection: DesktopTableSection
  },
  key: DesktopNavigateKey
): void {
  const lastRow = table.bodyRows.length
  const lastCol = table.columnCount - 1
  const { activeCell, anchorCell, outlinedSection } = interaction

  const exitAfter = () =>
    placeCursorAfterTable(view, findTableToByFrom(view.state, tableFrom) ?? tableTo)

  switch (key) {
    case 'tab': {
      if (activeCell.col < lastCol)
        moveTo(view, tableFrom, { row: activeCell.row, col: activeCell.col + 1 })
      else if (activeCell.row < lastRow)
        moveTo(view, tableFrom, { row: activeCell.row + 1, col: 0 })
      else
        invokeTableAction(view, {
          type: 'addRow',
          tableFrom,
          tableTo,
          atIndex: table.bodyRows.length,
          focusAfter: { rowIndex: table.bodyRows.length, colIndex: 0 }
        })
      return
    }
    case 'shift-tab': {
      if (activeCell.row === 0 && activeCell.col === 0) {
        invokeTableAction(view, {
          type: 'addRow',
          tableFrom,
          tableTo,
          atIndex: 0,
          focusAfter: { rowIndex: 0, colIndex: 0 }
        })
        return
      }
      if (activeCell.col > 0)
        moveTo(view, tableFrom, { row: activeCell.row, col: activeCell.col - 1 })
      else if (activeCell.row > 0)
        moveTo(view, tableFrom, { row: activeCell.row - 1, col: lastCol })
      return
    }
    case 'enter': {
      if (activeCell.row < lastRow)
        moveTo(view, tableFrom, { row: activeCell.row + 1, col: activeCell.col })
      else
        invokeTableAction(view, {
          type: 'addRow',
          tableFrom,
          tableTo,
          atIndex: table.bodyRows.length,
          focusAfter: {
            rowIndex: activeCell.row <= 0 ? 0 : activeCell.row - 1,
            colIndex: activeCell.col
          }
        })
      return
    }
    case 'arrow-left': {
      if (activeCell.col > 0)
        moveTo(view, tableFrom, { row: activeCell.row, col: activeCell.col - 1 })
      else if (activeCell.row > 0)
        moveTo(view, tableFrom, { row: activeCell.row - 1, col: lastCol })
      else exitAfter()
      return
    }
    case 'arrow-up': {
      if (activeCell.row > 0)
        moveTo(view, tableFrom, { row: activeCell.row - 1, col: activeCell.col })
      else exitAfter()
      return
    }
    case 'arrow-right': {
      if (activeCell.col < lastCol)
        moveTo(view, tableFrom, { row: activeCell.row, col: activeCell.col + 1 })
      else if (activeCell.row < lastRow)
        moveTo(view, tableFrom, { row: activeCell.row + 1, col: 0 })
      else exitAfter()
      return
    }
    case 'arrow-down': {
      if (activeCell.row < lastRow)
        moveTo(view, tableFrom, { row: activeCell.row + 1, col: activeCell.col })
      else exitAfter()
      return
    }
    case 'shift-arrow-left': {
      if (outlinedSection.endCol === anchorCell.col) {
        if (outlinedSection.startCol === 0) return
        dispatchMove(
          view,
          tableFrom,
          { row: activeCell.row, col: activeCell.col - 1 },
          anchorCell,
          outlinedSection.expandLeft()
        )
      } else {
        dispatchMove(
          view,
          tableFrom,
          { row: activeCell.row, col: activeCell.col - 1 },
          anchorCell,
          outlinedSection.contractLeft()
        )
      }
      return
    }
    case 'shift-arrow-right': {
      if (outlinedSection.startCol === anchorCell.col) {
        if (outlinedSection.endCol >= lastCol) return
        dispatchMove(
          view,
          tableFrom,
          { row: activeCell.row, col: activeCell.col + 1 },
          anchorCell,
          outlinedSection.expandRight()
        )
      } else {
        dispatchMove(
          view,
          tableFrom,
          { row: activeCell.row, col: activeCell.col + 1 },
          anchorCell,
          outlinedSection.contractRight()
        )
      }
      return
    }
    case 'shift-arrow-up': {
      if (outlinedSection.endRow === anchorCell.row) {
        if (outlinedSection.startRow === 0) return
        dispatchMove(
          view,
          tableFrom,
          { row: activeCell.row - 1, col: activeCell.col },
          anchorCell,
          outlinedSection.expandUp()
        )
      } else {
        dispatchMove(
          view,
          tableFrom,
          { row: activeCell.row - 1, col: activeCell.col },
          anchorCell,
          outlinedSection.contractUp()
        )
      }
      return
    }
    case 'shift-arrow-down': {
      if (outlinedSection.startRow === anchorCell.row) {
        if (outlinedSection.endRow >= lastRow) return
        dispatchMove(
          view,
          tableFrom,
          { row: activeCell.row + 1, col: activeCell.col },
          anchorCell,
          outlinedSection.expandDown()
        )
      } else {
        dispatchMove(
          view,
          tableFrom,
          { row: activeCell.row + 1, col: activeCell.col },
          anchorCell,
          outlinedSection.contractDown()
        )
      }
    }
  }
}

export function matchDesktopNavigateKey(event: KeyboardEvent): DesktopNavigateKey | null {
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
