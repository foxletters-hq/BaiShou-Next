import { describe, it, expect } from 'vitest'
import { isCellInTableRange, normalizeTableCellRange } from '../table/tableRangeSelection'

describe('tableRangeSelection', () => {
  it('normalizes anchor/head into bounds', () => {
    const bounds = normalizeTableCellRange({
      tableFrom: 0,
      anchorRow: 2,
      anchorCol: 3,
      headRow: 0,
      headCol: 1
    })
    expect(bounds).toEqual({ minRow: 0, maxRow: 2, minCol: 1, maxCol: 3 })
  })

  it('includes header row in range checks', () => {
    const bounds = normalizeTableCellRange({
      tableFrom: 0,
      anchorRow: -1,
      anchorCol: 0,
      headRow: 1,
      headCol: 1
    })
    expect(isCellInTableRange(-1, 0, bounds)).toBe(true)
    expect(isCellInTableRange(1, 1, bounds)).toBe(true)
    expect(isCellInTableRange(2, 0, bounds)).toBe(false)
  })
})
