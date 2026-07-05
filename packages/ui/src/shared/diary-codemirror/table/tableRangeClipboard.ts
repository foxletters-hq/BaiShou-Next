import type { NormalizedTableCellRange } from './tableRangeSelection'
import { TableSection } from './tableSection'
import {
  clearGridSection,
  mergeTsvIntoGrid,
  readTableGridFromBlock,
  sliceSectionAsMarkdown,
  maybeParseClipboardGrid,
  mergeGridIntoSection,
  type TableGridModel
} from './tableGridModel'
import { writeTextToClipboardSync } from './tableDom'
import { normalizeTableCellDisplay } from './tableCellText'

function boundsToSection(bounds: NormalizedTableCellRange): TableSection {
  return TableSection.of(
    { start: bounds.minRow, endExclusive: bounds.maxRow + 1 },
    { start: bounds.minCol, endExclusive: bounds.maxCol + 1 }
  )
}

export function readRangeClipboardText(
  block: HTMLElement,
  bounds: NormalizedTableCellRange
): string {
  const grid = readTableGridFromBlock(block)
  if (!grid) return ''
  return sliceSectionAsMarkdown(grid, boundsToSection(bounds))
}

export function copyTableRange(block: HTMLElement, bounds: NormalizedTableCellRange): boolean {
  return writeTextToClipboardSync(readRangeClipboardText(block, bounds))
}

export function clearTableRange(block: HTMLElement, bounds: NormalizedTableCellRange): void {
  const grid = readTableGridFromBlock(block)
  if (!grid) return
  clearGridSection(grid, boundsToSection(bounds))
  applyGridToBlockDom(block, grid, bounds)
}

export function pasteTableRange(
  block: HTMLElement,
  bounds: NormalizedTableCellRange,
  clipboardText: string
): void {
  const grid = readTableGridFromBlock(block)
  if (!grid) return
  const section = boundsToSection(bounds)
  const parsed = maybeParseClipboardGrid(clipboardText)
  if (parsed && (parsed.header.length > 1 || parsed.rows.length > 0)) {
    mergeGridIntoSection(grid, parsed, { row: section.startRow, col: section.startCol })
  } else {
    mergeTsvIntoGrid(grid, section, clipboardText)
  }
  applyGridToBlockDom(block, grid, bounds)
}

function applyGridToBlockDom(
  block: HTMLElement,
  grid: TableGridModel,
  bounds: NormalizedTableCellRange
): void {
  for (let row = bounds.minRow; row <= bounds.maxRow; row += 1) {
    for (let col = bounds.minCol; col <= bounds.maxCol; col += 1) {
      const raw = row === -1 ? (grid.header[col] ?? '') : (grid.rows[row]?.[col] ?? '')
      const display = normalizeTableCellDisplay(raw)
      const nodes = block.querySelectorAll(`[data-row="${row}"][data-col="${col}"]`)
      nodes.forEach((node) => {
        const el = node as HTMLElement
        if (el.classList.contains('cm-table-cell-view')) {
          el.textContent = display
        }
        if (el.classList.contains('cm-table-cell-source')) {
          el.dataset.raw = raw
        }
      })
    }
  }
}

export async function readClipboardTextForTablePaste(): Promise<string> {
  try {
    return await navigator.clipboard.readText()
  } catch {
    return ''
  }
}
