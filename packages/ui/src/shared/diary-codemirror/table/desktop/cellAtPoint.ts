import type { CellLocation } from './models/cellLocation'

function cellFromElement(el: Element | null, tableRoot: HTMLElement): CellLocation | null {
  const hit = el?.closest('.cm-table-grid-cell') as HTMLElement | null
  if (!hit || !tableRoot.contains(hit)) return null
  const row = Number(hit.dataset.row)
  const col = Number(hit.dataset.col)
  if (Number.isNaN(row) || Number.isNaN(col)) return null
  return { row, col }
}

/** 用 hit-test 定位单元格；eventTarget 作为 jsdom / 无坐标时的回退 */
export function cellAtPoint(
  tableRoot: HTMLElement,
  clientX: number,
  clientY: number,
  eventTarget?: Element | null
): CellLocation | null {
  if (typeof document.elementFromPoint === 'function') {
    const fromPoint = cellFromElement(document.elementFromPoint(clientX, clientY), tableRoot)
    if (fromPoint) return fromPoint
  }
  return cellFromElement(eventTarget ?? null, tableRoot)
}
