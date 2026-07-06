import type { ParsedTable } from './table.model'
import { parseCellsFromLine, serializeTable, splitTableRowCells } from './table.model'
import { encodeTableCellText } from './tableCellText'
import { normalizeTableCellDisplay } from './tableCellText'
import { TableSection, type CellLocation } from './tableSection'

/** 内存表格网格：header 行索引 -1，body 从 0 起 */
export type ColumnAlignment = 'left' | 'center' | 'right' | 'none'

export type TableGridModel = {
  header: string[]
  rows: string[][]
  alignments?: ColumnAlignment[]
}

export function tableGridFromParsed(table: ParsedTable): TableGridModel {
  return {
    header: [...table.header.cells],
    rows: table.bodyRows.map((row) => [...row.cells])
  }
}

export function getGridCell(grid: TableGridModel, row: number, col: number): string {
  if (row === -1) return grid.header[col] ?? ''
  return grid.rows[row]?.[col] ?? ''
}

export function setGridCell(grid: TableGridModel, row: number, col: number, value: string): void {
  const encoded = encodeTableCellText(value)
  if (row === -1) {
    grid.header[col] = encoded
    return
  }
  if (!grid.rows[row]) grid.rows[row] = []
  grid.rows[row]![col] = encoded
}

export function sliceSectionAsTsv(grid: TableGridModel, section: TableSection): string {
  const lines: string[] = []
  for (let row = section.startRow; row <= section.endRow; row += 1) {
    const cells: string[] = []
    for (let col = section.startCol; col <= section.endCol; col += 1) {
      cells.push(normalizeTableCellDisplay(getGridCell(grid, row, col)))
    }
    lines.push(cells.join('\t'))
  }
  return lines.join('\n')
}

/** ckant：区域复制为 Markdown 子表（含 header + separator） */
export function sliceSectionAsMarkdown(grid: TableGridModel, section: TableSection): string {
  const colIndexes = Array.from({ length: section.colCount }, (_, i) => section.startCol + i)
  const selectedRows: string[][] = []
  for (let row = section.startRow; row <= section.endRow; row += 1) {
    selectedRows.push(colIndexes.map((col) => getGridCell(grid, row, col)))
  }
  if (selectedRows.length === 0) return ''
  const alignments = colIndexes.map((col) => grid.alignments?.[col] ?? 'none')
  return serializeTable(selectedRows[0]!, selectedRows.slice(1), alignments)
}

export function clearGridSection(grid: TableGridModel, section: TableSection): void {
  for (let row = section.startRow; row <= section.endRow; row += 1) {
    for (let col = section.startCol; col <= section.endCol; col += 1) {
      setGridCell(grid, row, col, '')
    }
  }
}

export function mergeTsvIntoGrid(
  grid: TableGridModel,
  section: TableSection,
  clipboardText: string
): void {
  const rows = clipboardText.replace(/\r\n/g, '\n').split('\n')
  for (let r = 0; r < rows.length; r += 1) {
    if (rows[r]!.length === 0) continue
    const targetRow = section.startRow + r
    const cells = rows[r]!.split('\t')
    for (let c = 0; c < cells.length; c += 1) {
      const targetCol = section.startCol + c
      setGridCell(grid, targetRow, targetCol, cells[c] ?? '')
    }
  }
}

/** 将已编码的 grid 行写入目标区域（不再重复 encode） */
export function mergeEncodedRowsIntoGrid(
  target: TableGridModel,
  sourceRows: string[][],
  at: CellLocation
): void {
  for (let r = 0; r < sourceRows.length; r += 1) {
    const row = sourceRows[r]!
    for (let c = 0; c < row.length; c += 1) {
      const targetRow = at.row + r
      const targetCol = at.col + c
      const value = row[c] ?? ''
      if (targetRow === -1) {
        target.header[targetCol] = value
      } else {
        if (!target.rows[targetRow]) target.rows[targetRow] = []
        target.rows[targetRow]![targetCol] = value
      }
    }
  }
}

export function isMarkdownTableClipboard(text: string): boolean {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length < 2) return false
  if (!lines.some((line) => line.startsWith('|'))) return false
  return lines.some((line) => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line))
}

/** 多行 / TSV / Markdown 表格应走区域粘贴，而非根编辑器或单格 CM 默认粘贴 */
export function shouldUseTableRangePaste(text: string): boolean {
  if (!text.trim()) return false
  if (isMarkdownTableClipboard(text)) return true
  if (text.includes('\t')) return true
  return (
    text
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter((line) => line.length > 0).length > 1
  )
}

export function tsvPasteDimensions(text: string): { rowCount: number; colCount: number } {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.length > 0)
  const colCount = Math.max(1, ...lines.map((line) => line.split('\t').length))
  return { rowCount: Math.max(1, lines.length), colCount }
}

/** 尝试将剪贴板解析为表格（多行管道符或 TSV） */
export function maybeParseClipboardGrid(text: string): TableGridModel | null {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.length > 0)
  if (lines.length === 0) return null

  const parsedRows = lines.map((line) => {
    if (line.trim().startsWith('|')) return parseCellsFromLine(line)
    return splitTableRowCells(line.includes('\t') ? line : `| ${line} |`)
  })
  if (parsedRows.some((row) => row.length === 0)) return null

  const colCount = Math.max(...parsedRows.map((row) => row.length))
  const normalized = parsedRows.map((row) => {
    const next = [...row]
    while (next.length < colCount) next.push('')
    return next.slice(0, colCount)
  })

  if (normalized.length >= 2 && normalized[1]!.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))) {
    return {
      header: normalized[0]!.map(encodeTableCellText),
      rows: normalized.slice(2).map((row) => row.map(encodeTableCellText))
    }
  }

  if (normalized.length === 1) {
    return { header: [''], rows: [[encodeTableCellText(normalized[0]![0] ?? '')]] }
  }

  return {
    header: normalized[0]!.map(encodeTableCellText),
    rows: normalized.slice(1).map((row) => row.map(encodeTableCellText))
  }
}

export function mergeGridIntoSection(
  target: TableGridModel,
  source: TableGridModel,
  at: CellLocation
): void {
  const sourceRows = [source.header, ...source.rows]
  for (let r = 0; r < sourceRows.length; r += 1) {
    const targetRow = at.row + r
    const row = sourceRows[r]!
    for (let c = 0; c < row.length; c += 1) {
      setGridCell(target, targetRow, at.col + c, row[c] ?? '')
    }
  }
}

export function gridToMarkdown(grid: TableGridModel): string {
  return serializeTable(grid.header, grid.rows, grid.alignments)
}

/** 将粘贴块平铺 rowMult × colMult 次（ckant pasteTable tiling） */
export function repeatPasteGrid(
  source: TableGridModel,
  rowMult: number,
  colMult: number
): TableGridModel {
  const rm = Math.max(1, rowMult)
  const cm = Math.max(1, colMult)
  const header: string[] = []
  for (let c = 0; c < cm; c += 1) header.push(...source.header)
  const rows: string[][] = []
  for (let r = 0; r < rm; r += 1) {
    for (const srcRow of source.rows) {
      const row: string[] = []
      for (let c = 0; c < cm; c += 1) row.push(...srcRow)
      rows.push(row)
    }
  }
  const alignments = source.alignments
    ? Array.from({ length: cm }, () => source.alignments!).flat()
    : undefined
  return { header, rows, alignments }
}

export function pasteBlockRowCount(source: TableGridModel): number {
  return 1 + source.rows.length
}

export function isGridRowEmpty(grid: TableGridModel, row: number): boolean {
  if (row === -1) return grid.header.every((c) => !normalizeTableCellDisplay(c))
  return (grid.rows[row] ?? []).every((c) => !normalizeTableCellDisplay(c))
}

export function isGridColEmpty(grid: TableGridModel, col: number): boolean {
  if ((grid.header[col] ?? '').trim()) return false
  return grid.rows.every((row) => !(row[col] ?? '').trim())
}

export function removeGridRowsAt(grid: TableGridModel, index: number, count: number): void {
  grid.rows.splice(index, count)
}

export function removeGridColsAt(grid: TableGridModel, index: number, count: number): void {
  grid.header.splice(index, count)
  grid.rows.forEach((row) => row.splice(index, count))
  if (grid.alignments) grid.alignments.splice(index, count)
}

export function insertGridRowsAt(grid: TableGridModel, index: number, count: number): void {
  const colCount = grid.header.length
  for (let i = 0; i < count; i += 1) {
    grid.rows.splice(
      index,
      0,
      Array.from({ length: colCount }, () => '')
    )
  }
}

export function insertGridColsAt(grid: TableGridModel, index: number, count: number): void {
  for (let i = 0; i < count; i += 1) grid.header.splice(index, 0, '')
  grid.rows.forEach((row) => {
    for (let i = 0; i < count; i += 1) row.splice(index, 0, '')
  })
  if (grid.alignments) {
    for (let i = 0; i < count; i += 1) grid.alignments.splice(index, 0, 'none')
  }
}

export function readGridCellFromDom(block: HTMLElement, row: number, col: number): string {
  const editorMount = block.querySelector(
    `.cm-table-cell-editor[data-row="${row}"][data-col="${col}"] .cm-content`
  ) as HTMLElement | null
  if (editorMount) {
    return encodeTableCellText((editorMount.textContent ?? '').trim())
  }
  const source = block.querySelector(
    `.cm-table-cell-source[data-row="${row}"][data-col="${col}"]`
  ) as HTMLElement | null
  if (source) {
    const raw = source.dataset.raw
    if (raw != null) return raw
    return encodeTableCellText((source.textContent ?? '').trim())
  }
  const view = block.querySelector(
    `.cm-table-cell-view[data-row="${row}"][data-col="${col}"]`
  ) as HTMLElement | null
  if (view) {
    return encodeTableCellText((view.textContent ?? '').trim())
  }
  return ''
}

function queryCellDisplays(container: Element, row: number): HTMLElement[] {
  const views = Array.from(
    container.querySelectorAll(`.cm-table-cell-view[data-row="${row}"]`)
  ) as HTMLElement[]
  if (views.length > 0) {
    return views.sort((a, b) => Number(a.dataset.col) - Number(b.dataset.col))
  }
  return Array.from(
    container.querySelectorAll(`.cm-table-cell-source[data-row="${row}"]:not([hidden])`)
  )
    .filter((el) => !(el as HTMLElement).hidden)
    .sort(
      (a, b) => Number((a as HTMLElement).dataset.col) - Number((b as HTMLElement).dataset.col)
    ) as HTMLElement[]
}

export function readTableGridFromBlock(block: HTMLElement): TableGridModel | null {
  const headerCells = queryCellDisplays(block.querySelector('thead') ?? block, -1)
  if (headerCells.length === 0) return null

  const header = headerCells.map((el) =>
    readGridCellFromDom(block, Number(el.dataset.row), Number(el.dataset.col))
  )

  const bodyRows: string[][] = []
  const rowEls = Array.from(block.querySelectorAll('tbody tr'))
  rowEls.forEach((tr, rowIndex) => {
    const rowNum = Number(
      (tr.querySelector('[data-row]') as HTMLElement | null)?.dataset.row ?? rowIndex
    )
    const cells = queryCellDisplays(tr, rowNum)
    bodyRows[rowIndex] = cells.map((el) =>
      readGridCellFromDom(block, Number(el.dataset.row), Number(el.dataset.col))
    )
  })

  return { header, rows: bodyRows }
}
