import type { CellLocation } from './tableSection'

type RowOrColMeasurement = {
  start: number
  size: number
}

function clientRect(
  node: HTMLElement,
  scrollOffset: { x: number; y: number }
): { top: number; left: number; width: number; height: number } {
  const { top, left, width, height } = node.getBoundingClientRect()
  return { top: top + scrollOffset.y, left: left + scrollOffset.x, width, height }
}

/** 根据表格 DOM 测量行列边界（对齐 ckant TableMeasurement） */
export class TableMeasurement {
  readonly rows: RowOrColMeasurement[]
  readonly cols: RowOrColMeasurement[]

  get rowCount(): number {
    return this.rows.length
  }

  get colCount(): number {
    return this.cols.length
  }

  lastCellBeforePosition(position: { x: number; y: number }): CellLocation {
    const maybeRow = this.rows.map((it) => it.start).findLastIndex((start) => start < position.y)
    const maybeCol = this.cols.map((it) => it.start).findLastIndex((start) => start < position.x)
    return {
      row: maybeRow === -1 ? 0 : maybeRow,
      col: maybeCol === -1 ? 0 : maybeCol
    }
  }

  static of(
    tableElement: HTMLTableElement,
    scrollOffset: { x: number; y: number }
  ): TableMeasurement {
    const firstRowCells = [
      ...tableElement.querySelectorAll<HTMLTableCellElement>(
        'tr:first-child > th, tr:first-child > td'
      )
    ]
    const firstColCells = [
      ...tableElement.querySelectorAll<HTMLTableCellElement>(
        'tr > th:first-child, tr > td:first-child'
      )
    ]

    const rows = firstColCells.map((cell, i) => {
      const { top, height } = clientRect(cell, scrollOffset)
      const offset = i === 0 ? 0 : 0
      return { start: top + offset, size: height - offset }
    })
    const cols = firstRowCells.map((cell, i) => {
      const { left, width } = clientRect(cell, scrollOffset)
      const offset = i === 0 ? 1 : 0
      return { start: left + offset, size: width - offset }
    })

    return new TableMeasurement(rows, cols)
  }

  private constructor(rows: RowOrColMeasurement[], cols: RowOrColMeasurement[]) {
    this.rows = rows
    this.cols = cols
  }
}
