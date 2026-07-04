import type { NormalizedTableCellRange } from './tableRangeSelection'
import { isCellInTableRange } from './tableRangeSelection'

export function applyRangeHighlightToBlock(
  block: HTMLElement,
  bounds: NormalizedTableCellRange | null
): void {
  block.classList.toggle('cm-table-block--range-selected', bounds != null)
  block.querySelectorAll('.cm-table-grid-cell').forEach((cell) => {
    const el = cell as HTMLElement
    const row = Number(el.dataset.row)
    const col = Number(el.dataset.col)
    const selected = bounds != null && isCellInTableRange(row, col, bounds)
    el.classList.toggle('cm-table-grid-cell--range-selected', selected)
  })
}

export function setTableRangeDragging(block: HTMLElement, dragging: boolean): void {
  block.classList.toggle('cm-table-block--range-dragging', dragging)
}
