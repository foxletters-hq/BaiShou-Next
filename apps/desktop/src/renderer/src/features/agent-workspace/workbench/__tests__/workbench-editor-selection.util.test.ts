import { describe, expect, it } from 'vitest'
import {
  normalizeEditorLineRange,
  selectionLinesFromOffsets
} from '../workbench-editor-selection.util'

describe('normalizeEditorLineRange', () => {
  it('orders inverted line numbers', () => {
    expect(normalizeEditorLineRange(20, 12)).toEqual({ startLine: 12, endLine: 20 })
  })
})

describe('selectionLinesFromOffsets', () => {
  it('returns null for a collapsed caret', () => {
    expect(selectionLinesFromOffsets(10, 10, () => 3)).toBeNull()
  })

  it('maps a range that stays on one line', () => {
    expect(selectionLinesFromOffsets(4, 9, () => 2)).toEqual({ startLine: 2, endLine: 2 })
  })

  it('does not include the next line when the open end is at its line start', () => {
    expect(
      selectionLinesFromOffsets(0, 6, (pos) => {
        if (pos < 6) return 1
        return 2
      })
    ).toEqual({ startLine: 1, endLine: 1 })
  })
})
