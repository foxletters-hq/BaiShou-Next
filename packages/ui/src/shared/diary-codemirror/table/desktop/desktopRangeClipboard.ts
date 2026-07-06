import type { EditorView } from '@codemirror/view'
import type { NormalizedTableCellRange } from '../tableRangeSelection'
import { TableSection } from '../tableSection'
import {
  clearGridSection,
  isMarkdownTableClipboard,
  mergeEncodedRowsIntoGrid,
  mergeTsvIntoGrid,
  maybeParseClipboardGrid,
  repeatPasteGrid,
  sliceSectionAsMarkdown,
  tsvPasteDimensions,
  type TableGridModel
} from '../tableGridModel'
import { formatDesktopTableCellDisplay } from '../tableCellText'
import { writeTextToClipboardSync } from '../tableDom'
import { commitDesktopTableToDoc } from './tableDescription'
import { domRowToParsedRow, parsedRowToDomRow } from './models/cellLocation'
import { DesktopTableSection } from './models/desktopTableSection'
import { setDesktopTableInteraction, type DesktopTableInteraction } from './tableInteractionField'
import { readTableGridFromDesktopBlock } from './readDesktopGrid'

export function domSectionToParsedBounds(section: DesktopTableSection): NormalizedTableCellRange {
  return {
    minRow: domRowToParsedRow(section.startRow),
    maxRow: domRowToParsedRow(section.endRow),
    minCol: section.startCol,
    maxCol: section.endCol
  }
}

function parsedBoundsToSection(bounds: NormalizedTableCellRange): TableSection {
  return TableSection.of(
    { start: bounds.minRow, endExclusive: bounds.maxRow + 1 },
    { start: bounds.minCol, endExclusive: bounds.maxCol + 1 }
  )
}

function applyDesktopGridSection(
  block: HTMLElement,
  grid: TableGridModel,
  bounds: NormalizedTableCellRange
): void {
  for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
    const domRow = parsedRowToDomRow(row)
    for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) {
      const raw = row === -1 ? (grid.header[col] ?? '') : (grid.rows[row]?.[col] ?? '')
      const display = formatDesktopTableCellDisplay(raw)
      block.querySelectorAll(`[data-row="${domRow}"][data-col="${col}"]`).forEach((node) => {
        const el = node as HTMLElement
        if (el.classList.contains('cm-table-cell-view')) el.textContent = display
        if (el.classList.contains('cm-table-cell-source')) el.dataset.raw = raw
      })
    }
  }
}

export function desktopCopyTableRange(
  block: HTMLElement,
  bounds: NormalizedTableCellRange,
  view?: EditorView
): boolean {
  const grid = readTableGridFromDesktopBlock(block, view)
  if (!grid) return false
  return writeTextToClipboardSync(sliceSectionAsMarkdown(grid, parsedBoundsToSection(bounds)))
}

export function desktopClearTableRange(block: HTMLElement, bounds: NormalizedTableCellRange): void {
  const grid = readTableGridFromDesktopBlock(block)
  if (!grid) return
  clearGridSection(grid, parsedBoundsToSection(bounds))
  applyDesktopGridSection(block, grid, bounds)
}

function expandPasteBounds(
  bounds: NormalizedTableCellRange,
  rowCount: number,
  colCount: number
): NormalizedTableCellRange {
  return {
    minRow: bounds.minRow,
    maxRow: bounds.minRow + rowCount - 1,
    minCol: bounds.minCol,
    maxCol: bounds.minCol + colCount - 1
  }
}

/** ckant pasteTable：Markdown 块可平铺；TSV / 多行纯文本按行写入 */
export function desktopPasteTableRange(
  block: HTMLElement,
  bounds: NormalizedTableCellRange,
  clipboardText: string
): NormalizedTableCellRange {
  const grid = readTableGridFromDesktopBlock(block)
  if (!grid) return bounds
  const section = parsedBoundsToSection(bounds)
  const text = clipboardText.replace(/\r\n/g, '\n')

  if (isMarkdownTableClipboard(text)) {
    const parsed = maybeParseClipboardGrid(text)
    if (parsed) {
      const dataRows = bounds.minRow >= 0 ? parsed.rows : [parsed.header, ...parsed.rows]
      const selRowCount = bounds.maxRow - bounds.minRow + 1
      const selColCount = bounds.maxCol - bounds.minCol + 1
      const blockRows = dataRows.length
      const blockCols = Math.max(1, ...dataRows.map((row) => row.length))
      const rowMult = Math.max(1, Math.floor(selRowCount / blockRows))
      const colMult = Math.max(1, Math.floor(selColCount / blockCols))
      const expanded =
        rowMult > 1 || colMult > 1
          ? repeatPasteGrid({ header: [''], rows: dataRows }, rowMult, colMult).rows
          : dataRows
      mergeEncodedRowsIntoGrid(grid, expanded, { row: bounds.minRow, col: bounds.minCol })
      const outBounds = expandPasteBounds(bounds, expanded.length, blockCols * colMult)
      applyDesktopGridSection(block, grid, outBounds)
      return outBounds
    }
  }

  if (text.includes('\t') || text.includes('\n')) {
    mergeTsvIntoGrid(grid, section, text)
    const { rowCount, colCount } = tsvPasteDimensions(text)
    const outBounds = expandPasteBounds(bounds, rowCount, colCount)
    applyDesktopGridSection(block, grid, outBounds)
    return outBounds
  }

  mergeTsvIntoGrid(grid, section, text)
  applyDesktopGridSection(block, grid, bounds)
  return bounds
}

export function applyDesktopTablePasteToBlock(
  view: EditorView,
  block: HTMLElement,
  bounds: NormalizedTableCellRange,
  interaction: DesktopTableInteraction,
  clipboardText: string
): NormalizedTableCellRange {
  const nextBounds = desktopPasteTableRange(block, bounds, clipboardText)
  commitDesktopTableToDoc(view, block)
  view.dispatch({
    effects: [
      setDesktopTableInteraction.of({
        ...interaction,
        activeCell: {
          row: parsedRowToDomRow(nextBounds.maxRow),
          col: nextBounds.maxCol
        },
        anchorCell: {
          row: parsedRowToDomRow(nextBounds.minRow),
          col: nextBounds.minCol
        },
        outlinedSection: DesktopTableSection.fromAnchorHead(
          { row: parsedRowToDomRow(nextBounds.minRow), col: nextBounds.minCol },
          { row: parsedRowToDomRow(nextBounds.maxRow), col: nextBounds.maxCol }
        ),
        mode: interaction.mode === 'all' ? 'all' : 'hidden'
      })
    ]
  })
  return nextBounds
}
