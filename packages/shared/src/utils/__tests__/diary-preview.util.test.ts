import { describe, expect, it } from 'vitest'
import { formatDiaryPreviewText } from '../diary-preview.util'

describe('formatDiaryPreviewText', () => {
  it('preserves line breaks after stripping markdown headings', () => {
    const raw = '##### 12:30:45\n\n第一段\n第二段'
    expect(formatDiaryPreviewText(raw)).toBe('12:30:45\n\n第一段\n第二段')
  })

  it('collapses horizontal whitespace without merging lines', () => {
    expect(formatDiaryPreviewText('hello   world\nfoo\t\tbar')).toBe('hello world\nfoo bar')
  })
})
