import { describe, expect, it } from 'vitest'
import {
  formatDiaryPreviewText,
  formatSemanticChunkSnippet,
  normalizeDiaryPreviewMarkdown,
  prepareDiaryCardPreviewMarkdown,
  convertFtsHighlightTagsToMarkdownBold,
  buildDiaryCardPreviewBlocks
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

  it('converts FTS <b> highlights to markdown bold instead of stripping', () => {
    const raw = '> 引用一句\n匹配<b>关键词</b>继续'
    expect(normalizeDiaryPreviewMarkdown(raw)).toBe('> 引用一句\n匹配**关键词**继续')
  })
})

describe('convertFtsHighlightTagsToMarkdownBold', () => {
  it('converts b and mark tags', () => {
    expect(convertFtsHighlightTagsToMarkdownBold('a<b>x</b>b<mark>y</mark>')).toBe('a**x**b**y**')
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

describe('buildDiaryCardPreviewBlocks', () => {
  it('renders only explicit quote lines as quote blocks', () => {
    const blocks = buildDiaryCardPreviewBlocks('正文\n> sadsad\nsadas')
    expect(blocks).toEqual([
      { kind: 'markdown', text: '正文' },
      { kind: 'quote', text: 'sadsad' },
      { kind: 'markdown', text: 'sadas' }
    ])
  })

  it('keeps consecutive quote lines as separate quote blocks', () => {
    const blocks = buildDiaryCardPreviewBlocks('> one\n> two')
    expect(blocks).toEqual([
      { kind: 'quote', text: 'one' },
      { kind: 'quote', text: 'two' }
    ])
  })
})

describe('prepareDiaryCardPreviewMarkdown', () => {
  it('strips ATX heading markers but keeps inline emphasis', () => {
    const raw = '###### 长标题换行\n正文 **加粗**'
    expect(prepareDiaryCardPreviewMarkdown(raw)).toBe('长标题换行\n正文 **加粗**')
  })

  it('keeps diary timestamp lines as markdown headings', () => {
    const raw = '##### 12:30\n\n正文 **加粗**'
    expect(prepareDiaryCardPreviewMarkdown(raw)).toBe('##### 12:30\n\n正文 **加粗**')
  })
})
