/** ckant 行号：0 = 表头，1+ = 数据行 */
export type CellLocation = {
  row: number
  col: number
}

export function cellEquals(a: CellLocation, b: CellLocation): boolean {
  return a.row === b.row && a.col === b.col
}

/** DOM/ckant 行号 → 内部 table.ops 行号（表头 -1） */
export function domRowToParsedRow(domRow: number): number {
  return domRow <= 0 ? -1 : domRow - 1
}

/** table.ops 行号 → DOM/ckant 行号 */
export function parsedRowToDomRow(parsedRow: number): number {
  return parsedRow < 0 ? 0 : parsedRow + 1
}
