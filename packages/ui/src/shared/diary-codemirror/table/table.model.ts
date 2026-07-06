import type { Text } from '@codemirror/state'
import { isTableSeparatorLine } from '../extensions/buildTable'
import type { ColumnAlignment } from './tableGridModel'

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

/** 按管道符切分列，保留空列；支持 `\|` 转义 */
export function splitTableRowCells(lineText: string): string[] {
  let s = lineText.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)

  const cells: string[] = []
  let buf = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '\\' && i + 1 < s.length) {
      buf += ch + s[i + 1]
      i++
      continue
    }
    if (ch === '|') {
      cells.push(buf.trim())
      buf = ''
      continue
    }
    buf += ch
  }
  cells.push(buf.trim())
  return cells
}

export function parseCellsFromLine(lineText: string): string[] {
  const trimmed = lineText.trim()
  if (!trimmed.startsWith('|')) return []
  return splitTableRowCells(lineText)
}

export function formatTableRow(cells: string[]): string {
  return `| ${cells.join(' | ')} |`
}

export function formatSeparatorRow(columnCount: number, alignments?: ColumnAlignment[]): string {
  const cells = Array.from({ length: columnCount }, (_, i) => {
    const a = alignments?.[i] ?? 'none'
    if (a === 'left') return ':---'
    if (a === 'center') return ':---:'
    if (a === 'right') return '---:'
    return '---'
  })
  return `| ${cells.join(' | ')} |`
}

export function parseSeparatorAlignments(lineText: string, columnCount: number): ColumnAlignment[] {
  const cells = parseCellsFromLine(lineText)
  return Array.from({ length: columnCount }, (_, i) => {
    const cell = (cells[i] ?? '').trim()
    if (cell.startsWith(':') && cell.endsWith(':')) return 'center'
    if (cell.startsWith(':')) return 'left'
    if (cell.endsWith(':')) return 'right'
    return 'none'
  })
}

function normalizeRowCells(cells: string[], columnCount: number): string[] {
  const next = [...cells]
  while (next.length < columnCount) next.push('')
  return next.slice(0, columnCount)
}

/** 列宽对齐美化（ckant prettify） */
export function prettifyTableCells(
  header: string[],
  body: string[][]
): { header: string[]; body: string[][] } {
  const colCount = header.length
  const widths = Array.from({ length: colCount }, (_, col) => {
    let max = header[col]?.length ?? 0
    for (const row of body) {
      max = Math.max(max, (row[col] ?? '').length)
    }
    return max
  })
  const pad = (cells: string[]) => cells.map((cell, col) => cell.padEnd(widths[col] ?? cell.length))
  return {
    header: pad(header),
    body: body.map((row) => pad(normalizeRowCells(row, colCount)))
  }
}

export function serializeTable(
  headerCells: string[],
  bodyRows: string[][],
  alignments?: ColumnAlignment[],
  options?: { prettify?: boolean }
): string {
  const colCount = headerCells.length
  let header = headerCells
  let body = bodyRows
  if (options?.prettify) {
    const pretty = prettifyTableCells(header, body)
    header = pretty.header
    body = pretty.body
  }
  const lines = [
    formatTableRow(header),
    formatSeparatorRow(colCount, alignments),
    ...body.map((row) => formatTableRow(normalizeRowCells(row, colCount)))
  ]
  return lines.join('\n')
}

/** 用于 TableBlockWidget.eq：检测 doc 侧内容变更（undo / 桥接同步） */
export function tableContentSignature(table: ParsedTable): string {
  const header = table.header.cells.join('\u001f')
  const rows = table.bodyRows.map((row) => row.cells.join('\u001f')).join('\u001e')
  return `${table.from}:${table.columnCount}:${header}\u001d${rows}`
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
  let lastPipeRowTo = separator.to

  for (let i = separatorIndex + 1; i < lines.length; i++) {
    const line = lines[i]!
    const cells = parseCellsFromLine(line.text)
    if (cells.length === 0) continue
    bodyRows.push({
      lineFrom: line.from,
      lineTo: line.to,
      cells: normalizeRowCells(cells, headerCells.length)
    })
    lastPipeRowTo = line.to
  }

  return {
    from: lines[0]!.from,
    to: lastPipeRowTo,
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
