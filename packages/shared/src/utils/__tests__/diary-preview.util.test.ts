import { describe, expect, it } from 'vitest'
import {
  formatDiaryPreviewText,
  formatSemanticChunkSnippet,
  normalizeDiaryPreviewMarkdown
} from '../diary-preview.util'

describe('normalizeDiaryPreviewMarkdown', () => {
  it('keeps markdown headings and emphasis', () => {
    const raw = '##### 12:30:45\n\n**加粗** 与 _斜体_'
    expect(normalizeDiaryPreviewMarkdown(raw)).toBe('##### 12:30:45\n\n**加粗** 与 _斜体_')
  })

  it('strips dedicated tag-only lines from card preview', () => {
    const raw = '#疲惫 #深夜 #反思\n\n##### 12:30:45\n\n今天很累'
    expect(normalizeDiaryPreviewMarkdown(raw)).toBe('##### 12:30:45\n\n今天很累')
  })
})

describe('formatDiaryPreviewText', () => {
  it('preserves line breaks after stripping markdown headings', () => {
    const raw = '##### 12:30:45\n\n第一段\n第二段'
    expect(formatDiaryPreviewText(raw)).toBe('12:30:45\n\n第一段\n第二段')
  })

  it('collapses horizontal whitespace without merging lines', () => {
    expect(formatDiaryPreviewText('hello   world\nfoo\t\tbar')).toBe('hello world\nfoo bar')
  })
})

describe('formatSemanticChunkSnippet', () => {
  it('strips diary embed prefix from semantic chunk text', () => {
    const raw = '[标签: 旅行] [2024-06-15 日记:]\n今天去爬山了'
    expect(formatSemanticChunkSnippet(raw)).toBe('今天去爬山了')
  })
})
