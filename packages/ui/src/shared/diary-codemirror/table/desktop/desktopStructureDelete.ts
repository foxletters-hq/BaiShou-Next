import type { EditorView } from '@codemirror/view'
import type { NormalizedTableCellRange } from '../tableRangeSelection'
import { isGridColEmpty, isGridRowEmpty, type TableGridModel } from '../tableGridModel'
import { invokeTableAction } from '../tableEffects'

/** ckant：Backspace 删除选中的空行/空列结构 */
export function tryDeleteEmptyTableStructure(
  view: EditorView,
  tableFrom: number,
  tableTo: number,
  grid: TableGridModel,
  bounds: NormalizedTableCellRange
): boolean {
  const colSpan = bounds.maxCol - bounds.minCol + 1
  const fullWidth = grid.header.length
  const fullHeight = grid.rows.length
  const coversAllCols = bounds.minCol === 0 && colSpan === fullWidth
  const coversAllBodyRows =
    bounds.minRow >= 0 && bounds.maxRow - bounds.minRow + 1 === fullHeight && bounds.minRow === 0

  if (coversAllCols) {
    const emptyRows: number[] = []
    for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
      if (row >= 0 && isGridRowEmpty(grid, row)) emptyRows.push(row)
    }
    if (emptyRows.length > 0) {
      for (let i = emptyRows.length - 1; i >= 0; i -= 1) {
        invokeTableAction(view, {
          type: 'deleteRow',
          tableFrom,
          tableTo,
          rowIndex: emptyRows[i]!
        })
      }
      return true
    }
  }

  if (coversAllBodyRows || (bounds.minRow <= -1 && bounds.maxRow >= fullHeight - 1)) {
    const emptyCols: number[] = []
    for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) {
      if (isGridColEmpty(grid, col)) emptyCols.push(col)
    }
    if (emptyCols.length > 0 && grid.header.length - emptyCols.length >= 1) {
      for (let i = emptyCols.length - 1; i >= 0; i -= 1) {
        invokeTableAction(view, {
          type: 'deleteColumn',
          tableFrom,
          tableTo,
          colIndex: emptyCols[i]!
        })
      }
      return true
    }
  }

  return false
}

export function clearGridRowsAt(grid: TableGridModel, rowIndex: number): void {
  if (rowIndex < 0) {
    grid.header.fill('')
    return
  }
  const row = grid.rows[rowIndex]
  if (row) row.fill('')
}

export function clearGridColsAt(grid: TableGridModel, colIndex: number): void {
  grid.header[colIndex] = ''
  grid.rows.forEach((row) => {
    row[colIndex] = ''
  })
}
