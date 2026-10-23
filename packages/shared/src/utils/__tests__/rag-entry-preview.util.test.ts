import { describe, expect, it } from 'vitest'
import {
  buildRagEntryListPreview,
  findKeywordRange,
  splitTextByKeyword
} from '../rag-entry-preview.util'

const diaryChunk = `[2024-10-23日记:]
#####21:37:48

曾经热烈过的证明还在抽屉里。`

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
    expect(preview).toContain('曾经热烈过的证明还在抽屉里。')
    expect(preview).not.toMatch(/^\[2024-10-23/)
    expect(matchStart).toBe(-1)
  })

  it('windows the preview around the first keyword so the date heading does not hide the hit', () => {
    const { preview, matchStart, matchLength } = buildRagEntryListPreview(diaryChunk, '证明')
    expect(preview).toContain('证明')
    expect(preview.slice(matchStart, matchStart + matchLength)).toBe('证明')
  })
})

describe('splitTextByKeyword', () => {
  it('marks every non-overlapping hit', () => {
    expect(splitTextByKeyword('证明甲，证明乙', '证明')).toEqual([
      { kind: 'mark', value: '证明' },
      { kind: 'text', value: '甲，' },
      { kind: 'mark', value: '证明' },
      { kind: 'text', value: '乙' }
    ])
  })
})
