import { describe, expect, it } from 'vitest'
import {
  buildRagEntryListPreview,
  findKeywordRange,
  splitTextByKeyword
} from '../rag-entry-preview.util'

const diaryChunk = `[2026-01-15日记:]
#####09:30:00

今天整理了桌面书架，顺便测试了全文检索功能。`

describe('findKeywordRange', () => {
  it('finds a case-insensitive substring', () => {
    expect(findKeywordRange('Hello Proof', 'proof')).toEqual({ start: 6, end: 11 })
  })

  it('returns null when the keyword is absent', () => {
    expect(findKeywordRange(diaryChunk, '不存在')).toBeNull()
  })
})

describe('buildRagEntryListPreview', () => {
  it('strips the diary date prefix when there is no keyword', () => {
    const { preview, matchStart } = buildRagEntryListPreview(diaryChunk)
    expect(preview).toContain('今天整理了桌面书架，顺便测试了全文检索功能。')
    expect(preview).not.toMatch(/^\[2026-01-15/)
    expect(matchStart).toBe(-1)
  })

  it('windows the preview around the first keyword so the date heading does not hide the hit', () => {
    const { preview, matchStart, matchLength } = buildRagEntryListPreview(diaryChunk, '检索')
    expect(preview).toContain('检索')
    expect(preview.slice(matchStart, matchStart + matchLength)).toBe('检索')
  })
})

describe('splitTextByKeyword', () => {
  it('marks every non-overlapping hit', () => {
    expect(splitTextByKeyword('检索甲，检索乙', '检索')).toEqual([
      { kind: 'mark', value: '检索' },
      { kind: 'text', value: '甲，' },
      { kind: 'mark', value: '检索' },
      { kind: 'text', value: '乙' }
    ])
  })
})
