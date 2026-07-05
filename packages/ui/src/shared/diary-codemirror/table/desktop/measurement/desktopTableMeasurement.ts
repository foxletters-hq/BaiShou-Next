import type { CellLocation } from '../models/cellLocation'

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

/** 行列边界测量（ckant TableMeasurement，行 0 = 表头） */
export class DesktopTableMeasurement {
  readonly tableElement: HTMLTableElement
  readonly rows: RowOrColMeasurement[]
  readonly cols: RowOrColMeasurement[]

  get rowCount(): number {
    return this.rows.length
  }

  get colCount(): number {
    return this.cols.length
  }

  get lastRowIndex(): number {
    return this.rowCount - 1
  }

  get lastColIndex(): number {
    return this.colCount - 1
  }

  lastCellBeforePosition(position: { x: number; y: number }): CellLocation {
    const maybeRow = this.rows
      .map((it) => it.start)
      .findLastIndex((start) => start < position.y)
    const maybeCol = this.cols
      .map((it) => it.start)
      .findLastIndex((start) => start < position.x)
    return {
      row: maybeRow === -1 ? 0 : maybeRow,
      col: maybeCol === -1 ? 0 : maybeCol
    }
  }

  static of(
    tableElement: HTMLTableElement,
    scrollOffset: { x: number; y: number }
  ): DesktopTableMeasurement {
    const firstRowCells = [
      ...tableElement.querySelectorAll<HTMLTableCellElement>('tr:first-child > th, tr:first-child > td')
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

    return new DesktopTableMeasurement(tableElement, rows, cols)
  }

  private constructor(
    tableElement: HTMLTableElement,
    rows: RowOrColMeasurement[],
    cols: RowOrColMeasurement[]
  ) {
    this.tableElement = tableElement
    this.rows = rows
    this.cols = cols
  }
}
