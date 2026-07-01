import type { Text } from '@codemirror/state'
import { isTableSeparatorLine } from '../extensions/buildTable'

export interface ParsedTableRow {
  lineFrom: number
  lineTo: number
  cells: string[]
}

export interface ParsedTable {
  from: number
  to: number
  header: ParsedTableRow
  separatorLineFrom: number
  separatorLineTo: number
  bodyRows: ParsedTableRow[]
  columnCount: number
}

export function parseCellsFromLine(lineText: string): string[] {
  const trimmed = lineText.trim()
  if (!trimmed.startsWith('|')) return []
  const inner = trimmed.replace(/^\|/, '').replace(/\|$/, '')
  if (!inner.trim()) return []
  return inner.split('|').map((cell) => cell.trim())
}

export function formatTableRow(cells: string[]): string {
  return `| ${cells.join(' | ')} |`
}

export function formatSeparatorRow(columnCount: number): string {
  return `| ${Array.from({ length: columnCount }, () => '---').join(' | ')} |`
}

export function serializeTable(headerCells: string[], bodyRows: string[][]): string {
  const colCount = headerCells.length
  const lines = [
    formatTableRow(headerCells),
    formatSeparatorRow(colCount),
    ...bodyRows.map((row) => formatTableRow(normalizeRowCells(row, colCount)))
  ]
  return lines.join('\n')
}

function normalizeRowCells(cells: string[], columnCount: number): string[] {
  const next = [...cells]
  while (next.length < columnCount) next.push('')
  return next.slice(0, columnCount)
}

export function parseTableFromDoc(doc: Text, from: number, to: number): ParsedTable | null {
  const startLineNum = doc.lineAt(from).number
  const endLineNum = doc.lineAt(to).number
  const lines = []
  for (let n = startLineNum; n <= endLineNum; n++) {
    lines.push(doc.line(n))
  }
  if (lines.length < 2) return null

  const separatorIndex = lines.findIndex((line) => isTableSeparatorLine(line.text))
  if (separatorIndex <= 0) return null

  const headerCells = parseCellsFromLine(lines[0]!.text)
  if (headerCells.length === 0) return null

  const separator = lines[separatorIndex]!
  const bodyRows: ParsedTableRow[] = []

  for (let i = separatorIndex + 1; i < lines.length; i++) {
    const line = lines[i]!
    const cells = parseCellsFromLine(line.text)
    if (cells.length === 0) continue
    bodyRows.push({
      lineFrom: line.from,
      lineTo: line.to,
      cells: normalizeRowCells(cells, headerCells.length)
    })
  }

  return {
    from: lines[0]!.from,
    to: lines[lines.length - 1]!.to,
    header: {
      lineFrom: lines[0]!.from,
      lineTo: lines[0]!.to,
      cells: headerCells
    },
    separatorLineFrom: separator.from,
    separatorLineTo: separator.to,
    bodyRows,
    columnCount: headerCells.length
  }
}
