import type { CellLocation } from './cellLocation'

export type SectionRange = {
  start: number
  endExclusive: number
}

/** 矩形选区（ckant 行号：0 = 表头） */
export class DesktopTableSection {
  readonly row: SectionRange
  readonly col: SectionRange

  get startRow(): number {
    return this.row.start
  }

  get endRow(): number {
    return this.row.endExclusive - 1
  }

  get startCol(): number {
    return this.col.start
  }

  get endCol(): number {
    return this.col.endExclusive - 1
  }

  isSingleCell(): boolean {
    return this.row.endExclusive - this.row.start === 1 && this.col.endExclusive - this.col.start === 1
  }

  containsCell({ row, col }: CellLocation): boolean {
    return (
      row >= this.row.start &&
      row < this.row.endExclusive &&
      col >= this.col.start &&
      col < this.col.endExclusive
    )
  }

  static ofCell(cell: CellLocation): DesktopTableSection {
    return new DesktopTableSection(
      { start: cell.row, endExclusive: cell.row + 1 },
      { start: cell.col, endExclusive: cell.col + 1 }
    )
  }

  static resolveHead(section: DesktopTableSection, anchor: CellLocation): CellLocation {
    if (section.isSingleCell()) return { ...anchor }
    const corners: CellLocation[] = [
      { row: section.startRow, col: section.startCol },
      { row: section.startRow, col: section.endCol },
      { row: section.endRow, col: section.startCol },
      { row: section.endRow, col: section.endCol }
    ]
    for (const corner of corners) {
      if (corner.row === anchor.row && corner.col === anchor.col) continue
      const candidate = DesktopTableSection.fromAnchorHead(anchor, corner)
      if (
        candidate.startRow === section.startRow &&
        candidate.endRow === section.endRow &&
        candidate.startCol === section.startCol &&
        candidate.endCol === section.endCol
      ) {
        return corner
      }
    }
    return { row: section.endRow, col: section.endCol }
  }

  static fromAnchorHead(anchor: CellLocation, head: CellLocation): DesktopTableSection {
    const startRow = Math.min(anchor.row, head.row)
    const endRow = Math.max(anchor.row, head.row)
    const startCol = Math.min(anchor.col, head.col)
    const endCol = Math.max(anchor.col, head.col)
    return new DesktopTableSection(
      { start: startRow, endExclusive: endRow + 1 },
      { start: startCol, endExclusive: endCol + 1 }
    )
  }

  expandLeft(): DesktopTableSection {
    return new DesktopTableSection(
      { ...this.row },
      { start: this.col.start - 1, endExclusive: this.col.endExclusive }
    )
  }

  expandRight(): DesktopTableSection {
    return new DesktopTableSection(
      { ...this.row },
      { start: this.col.start, endExclusive: this.col.endExclusive + 1 }
    )
  }

  expandUp(): DesktopTableSection {
    return new DesktopTableSection(
      { start: this.row.start - 1, endExclusive: this.row.endExclusive },
      { ...this.col }
    )
  }

  expandDown(): DesktopTableSection {
    return new DesktopTableSection(
      { start: this.row.start, endExclusive: this.row.endExclusive + 1 },
      { ...this.col }
    )
  }

  contractLeft(): DesktopTableSection {
    return new DesktopTableSection(
      { ...this.row },
      { start: this.col.start, endExclusive: this.col.endExclusive - 1 }
    )
  }

  contractRight(): DesktopTableSection {
    return new DesktopTableSection(
      { ...this.row },
      { start: this.col.start + 1, endExclusive: this.col.endExclusive }
    )
  }

  contractUp(): DesktopTableSection {
    return new DesktopTableSection(
      { start: this.row.start, endExclusive: this.row.endExclusive - 1 },
      { ...this.col }
    )
  }

  contractDown(): DesktopTableSection {
    return new DesktopTableSection(
      { start: this.row.start + 1, endExclusive: this.row.endExclusive },
      { ...this.col }
    )
  }

  private constructor(row: SectionRange, col: SectionRange) {
    this.row = row
    this.col = col
  }
}
