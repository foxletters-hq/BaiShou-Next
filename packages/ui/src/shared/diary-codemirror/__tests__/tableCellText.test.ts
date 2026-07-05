import { describe, it, expect } from 'vitest'
import {
  decodeTableCellText,
  encodeTableCellText,
  formatDesktopTableCellDisplay,
  normalizeTableCellDisplay
} from '../table/tableCellText'

describe('tableCellText', () => {
  it('round-trips escaped pipes', () => {
    expect(decodeTableCellText('left \\| right')).toBe('left | right')
    expect(encodeTableCellText('left | right')).toBe('left \\| right')
  })

  it('round-trips line breaks via br markup', () => {
    expect(decodeTableCellText('line one<br />line two')).toBe('line one\nline two')
    expect(encodeTableCellText('line one\nline two')).toBe('line one<br />line two')
  })

  it('normalizes display text to a single line', () => {
    expect(normalizeTableCellDisplay('a<br />b')).toBe('a b')
  })

  it('preserves line breaks for desktop cell display', () => {
    expect(formatDesktopTableCellDisplay('a<br />b')).toBe('a\nb')
  })
})
