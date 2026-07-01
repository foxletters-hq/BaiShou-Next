import type { ParsedTable } from './table.model'
import { serializeTable } from './table.model'

function cloneTableData(table: ParsedTable): { header: string[]; body: string[][] } {
  return {
    header: [...table.header.cells],
    body: table.bodyRows.map((row) => [...row.cells])
  }
}

export function buildTableMarkdown(table: ParsedTable): string {
  const { header, body } = cloneTableData(table)
  return serializeTable(header, body)
}

export function addTableColumnMarkdown(table: ParsedTable, atIndex?: number): string {
  const { header, body } = cloneTableData(table)
  const index = atIndex ?? header.length
  header.splice(index, 0, '')
  for (const row of body) {
    row.splice(index, 0, '')
  }
  return serializeTable(header, body)
}

export function addTableRowMarkdown(table: ParsedTable, atIndex?: number): string {
  const { header, body } = cloneTableData(table)
  const index = atIndex ?? body.length
  body.splice(index, 0, Array.from({ length: header.length }, () => ''))
  return serializeTable(header, body)
}

export function deleteTableColumnMarkdown(table: ParsedTable, colIndex: number): string | null {
  const { header, body } = cloneTableData(table)
  if (header.length <= 1) return null
  if (colIndex < 0 || colIndex >= header.length) return null
  header.splice(colIndex, 1)
  for (const row of body) {
    row.splice(colIndex, 1)
  }
  return serializeTable(header, body)
}

export function deleteTableRowMarkdown(table: ParsedTable, rowIndex: number): string | null {
  const { header, body } = cloneTableData(table)
  if (rowIndex < 0 || rowIndex >= body.length) return null
  body.splice(rowIndex, 1)
  return serializeTable(header, body)
}

export function moveTableColumnMarkdown(
  table: ParsedTable,
  fromIndex: number,
  toIndex: number
): string | null {
  const { header, body } = cloneTableData(table)
  if (fromIndex < 0 || fromIndex >= header.length) return null
  if (toIndex < 0 || toIndex >= header.length) return null
  if (fromIndex === toIndex) return buildTableMarkdown(table)

  const [headerCell] = header.splice(fromIndex, 1)
  header.splice(toIndex, 0, headerCell!)
  for (const row of body) {
    const [cell] = row.splice(fromIndex, 1)
    row.splice(toIndex, 0, cell ?? '')
  }
  return serializeTable(header, body)
}

export function moveTableRowMarkdown(
  table: ParsedTable,
  fromIndex: number,
  toIndex: number
): string | null {
  const { header, body } = cloneTableData(table)
  if (fromIndex < 0 || fromIndex >= body.length) return null
  if (toIndex < 0 || toIndex >= body.length) return null
  if (fromIndex === toIndex) return buildTableMarkdown(table)

  const [row] = body.splice(fromIndex, 1)
  body.splice(toIndex, 0, row!)
  return serializeTable(header, body)
}

export function updateTableCellMarkdown(
  table: ParsedTable,
  rowIndex: number,
  colIndex: number,
  value: string
): string | null {
  const { header, body } = cloneTableData(table)
  if (colIndex < 0 || colIndex >= header.length) return null
  if (rowIndex < 0) {
    header[colIndex] = value
  } else if (rowIndex < body.length) {
    body[rowIndex]![colIndex] = value
  } else {
    return null
  }
  return serializeTable(header, body)
}
