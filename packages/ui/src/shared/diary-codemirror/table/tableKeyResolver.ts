import type { ParsedTable } from './table.model'

export type TableKeyCommand =
  | 'tab'
  | 'shift-tab'
  | 'enter'
  | 'shift-enter'
  | 'escape'

export type TableKeyAction =
  | { kind: 'focus-cell'; rowIndex: number; colIndex: number }
  | { kind: 'insert-row-below'; afterRowIndex: number }
  | { kind: 'exit-after' }
  | { kind: 'insert-inline-break'; insertText: string }

function nextCell(
  table: ParsedTable,
  rowIndex: number,
  colIndex: number
): { rowIndex: number; colIndex: number } | null {
  const colCount = table.columnCount
  let nextRow = rowIndex
  let nextCol = colIndex + 1

  if (nextCol >= colCount) {
    nextCol = 0
    nextRow += 1
  }

  if (nextRow >= table.bodyRows.length) {
    return null
  }

  return { rowIndex: nextRow, colIndex: nextCol }
}

function prevCell(
  table: ParsedTable,
  rowIndex: number,
  colIndex: number
): { rowIndex: number; colIndex: number } | null {
  let prevRow = rowIndex
  let prevCol = colIndex - 1

  if (prevCol < 0) {
    prevCol = table.columnCount - 1
    prevRow -= 1
  }

  if (prevRow < -1) {
    return null
  }

  return { rowIndex: prevRow, colIndex: prevCol }
}

export function resolveTableKeyAction(
  table: ParsedTable,
  rowIndex: number,
  colIndex: number,
  command: TableKeyCommand
): TableKeyAction | null {
  switch (command) {
    case 'tab': {
      const adjacent = nextCell(table, rowIndex, colIndex)
      if (adjacent) {
        return { kind: 'focus-cell', ...adjacent }
      }
      return { kind: 'insert-row-below', afterRowIndex: table.bodyRows.length - 1 }
    }
    case 'shift-tab': {
      const adjacent = prevCell(table, rowIndex, colIndex)
      return adjacent ? { kind: 'focus-cell', ...adjacent } : null
    }
    case 'enter': {
      const adjacent = nextCell(table, rowIndex, colIndex)
      if (adjacent) {
        return { kind: 'focus-cell', ...adjacent }
      }
      if (rowIndex === table.bodyRows.length - 1 && colIndex === table.columnCount - 1) {
        return { kind: 'insert-row-below', afterRowIndex: rowIndex }
      }
      return { kind: 'focus-cell', rowIndex: -1, colIndex: 0 }
    }
    case 'shift-enter':
      return { kind: 'insert-inline-break', insertText: '\n' }
    case 'escape':
      return { kind: 'exit-after' }
    default:
      return null
  }
}
