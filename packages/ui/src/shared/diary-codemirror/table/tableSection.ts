/** 矩形单元格选区（对齐 ckant TableSection） */
export type TableSectionRange = {
  start: number
  endExclusive: number
}

export type CellLocation = {
  row: number
  col: number
}

export class TableSection {
  readonly row: TableSectionRange
  readonly col: TableSectionRange

  get startRow(): number {
    return this.row.start
  }

  get startCol(): number {
    return this.col.start
  }

  get endRow(): number {
    return this.row.endExclusive - 1
  }

  get endCol(): number {
    return this.col.endExclusive - 1
  }

  get rowCount(): number {
    return this.row.endExclusive - this.row.start
  }

  get colCount(): number {
    return this.col.endExclusive - this.col.start
  }

  containsCell({ row, col }: CellLocation): boolean {
    return (
      row >= this.startRow &&
      row < this.row.endExclusive &&
      col >= this.startCol &&
      col < this.col.endExclusive
    )
  }

  containsOnEdge({ row, col }: CellLocation): {
    top: boolean
    right: boolean
    bottom: boolean
    left: boolean
  } {
    if (!this.containsCell({ row, col })) {
      return { top: false, right: false, bottom: false, left: false }
    }
    return {
      top: row === this.startRow,
      right: col === this.endCol,
      bottom: row === this.endRow,
      left: col === this.startCol
    }
  }

  isSingleCell(): boolean {
    return this.rowCount === 1 && this.colCount === 1
  }

  static of(row: TableSectionRange, col: TableSectionRange): TableSection {
    return new TableSection(row, col)
  }

  static ofCell(cell: CellLocation): TableSection {
    return new TableSection(
      { start: cell.row, endExclusive: cell.row + 1 },
      { start: cell.col, endExclusive: cell.col + 1 }
    )
  }

  static fromAnchorHead(anchor: CellLocation, head: CellLocation): TableSection {
    const startRow = Math.min(anchor.row, head.row)
    const endRow = Math.max(anchor.row, head.row)
    const startCol = Math.min(anchor.col, head.col)
    const endCol = Math.max(anchor.col, head.col)
    return TableSection.of(
      { start: startRow, endExclusive: endRow + 1 },
      { start: startCol, endExclusive: endCol + 1 }
    )
  }

  expandUp(): TableSection {
    return TableSection.of(
      { start: this.row.start - 1, endExclusive: this.row.endExclusive },
      { ...this.col }
    )
  }

  expandRight(): TableSection {
    return TableSection.of(
      { ...this.row },
      { start: this.col.start, endExclusive: this.col.endExclusive + 1 }
    )
  }

  expandDown(): TableSection {
    return TableSection.of(
      { start: this.row.start, endExclusive: this.row.endExclusive + 1 },
      { ...this.col }
    )
  }

  expandLeft(): TableSection {
    return TableSection.of(
      { ...this.row },
      { start: this.col.start - 1, endExclusive: this.col.endExclusive }
    )
  }

  contractUp(): TableSection {
    return TableSection.of(
      { start: this.row.start, endExclusive: this.row.endExclusive - 1 },
      { ...this.col }
    )
  }

  contractRight(): TableSection {
    return TableSection.of(
      { ...this.row },
      { start: this.col.start + 1, endExclusive: this.col.endExclusive }
    )
  }

  contractDown(): TableSection {
    return TableSection.of(
      { start: this.row.start + 1, endExclusive: this.row.endExclusive },
      { ...this.col }
    )
  }

  contractLeft(): TableSection {
    return TableSection.of(
      { ...this.row },
      { start: this.col.start, endExclusive: this.col.endExclusive - 1 }
    )
  }

  private constructor(row: TableSectionRange, col: TableSectionRange) {
    this.row = row
    this.col = col
  }
}
