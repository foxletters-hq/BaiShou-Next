import type { EditorView } from '@codemirror/view'
import { isTableCellEditorFocused } from '../tableDom'
import type { NormalizedTableCellRange } from '../tableRangeSelection'
import { shouldUseTableRangePaste } from '../tableGridModel'
import { domRowToParsedRow } from './models/cellLocation'
import { DesktopTableSection } from './models/desktopTableSection'
import { applyDesktopTablePasteToBlock, domSectionToParsedBounds } from './desktopRangeClipboard'
import { desktopTableInteractionField, type DesktopTableInteraction } from './tableInteractionField'

export type DesktopTablePasteTarget = {
  block: HTMLElement
  tableFrom: number
  bounds: NormalizedTableCellRange
  interaction: DesktopTableInteraction
}

export function findActiveDesktopTablePasteTarget(
  view: EditorView
): DesktopTablePasteTarget | null {
  const interaction = view.state.field(desktopTableInteractionField, false)
  if (interaction) {
    const block = view.dom.querySelector(
      `.cm-table-block--desktop[data-table-from="${interaction.tableFrom}"]`
    ) as HTMLElement | null
    if (!block) return null
    return {
      block,
      tableFrom: interaction.tableFrom,
      bounds: domSectionToParsedBounds(interaction.outlinedSection),
      interaction
    }
  }

  const active = document.activeElement
  if (!(active instanceof HTMLElement)) return null
  const block = active.closest('.cm-table-block--desktop') as HTMLElement | null
  if (!block) return null

  const tableFrom = Number(block.dataset.tableFrom)
  if (Number.isNaN(tableFrom)) return null

  const cell = active.closest('.cm-table-grid-cell') as HTMLElement | null
  const domRow = Number(cell?.dataset.row ?? 0)
  const col = Number(cell?.dataset.col ?? 0)
  const parsedRow = domRowToParsedRow(domRow)
  const bounds: NormalizedTableCellRange = {
    minRow: parsedRow,
    maxRow: parsedRow,
    minCol: col,
    maxCol: col
  }
  const outlinedSection = DesktopTableSection.ofCell({ row: domRow, col })
  const fallbackInteraction: DesktopTableInteraction = {
    tableFrom,
    activeCell: { row: domRow, col },
    anchorCell: { row: domRow, col },
    outlinedSection,
    mode: 'hidden'
  }
  return { block, tableFrom, bounds, interaction: fallbackInteraction }
}

export function runDesktopTablePaste(view: EditorView, clipboardText: string): boolean {
  if (!shouldUseTableRangePaste(clipboardText)) return false

  const target = findActiveDesktopTablePasteTarget(view)
  if (!target) return false

  applyDesktopTablePasteToBlock(
    view,
    target.block,
    target.bounds,
    target.interaction,
    clipboardText
  )
  return true
}

export function shouldInterceptDesktopTablePaste(view: EditorView, clipboardText: string): boolean {
  if (!shouldUseTableRangePaste(clipboardText)) return false
  if (isTableCellEditorFocused()) return true
  return findActiveDesktopTablePasteTarget(view) != null
}
