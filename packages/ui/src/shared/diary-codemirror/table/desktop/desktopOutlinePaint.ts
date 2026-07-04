import type { DesktopTableSection } from './models/desktopTableSection'

/** ckant 风格：选区外框 data-outline，不用背景块 */
export function applyDesktopCellOutline(
  block: HTMLElement,
  section: DesktopTableSection | null
): void {
  block.querySelectorAll('.cm-table-grid-cell').forEach((cell) => {
    const el = cell as HTMLElement
    el.removeAttribute('data-outline')
    el.classList.remove('cm-table-grid-cell--range-selected')
  })

  if (!section) return

  for (let row = section.startRow; row <= section.endRow; row++) {
    for (let col = section.startCol; col <= section.endCol; col++) {
      const cell = block.querySelector(
        `.cm-table-grid-cell[data-row="${row}"][data-col="${col}"]`
      ) as HTMLElement | null
      if (!cell) continue

      const edges: string[] = []
      if (row === section.startRow) edges.push('top')
      if (row === section.endRow) edges.push('bottom')
      if (col === section.startCol) edges.push('left')
      if (col === section.endCol) edges.push('right')
      if (edges.length > 0) {
        cell.dataset.outline = edges.join(' ')
      }
    }
  }
}
