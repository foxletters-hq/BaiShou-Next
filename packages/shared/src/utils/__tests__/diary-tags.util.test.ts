import { describe, expect, it } from 'vitest'
import { limitDiaryPreviewTags, normalizeDiaryTags, buildDiaryEmbeddingTagPrefix } from '../diary-tags.util'

describe('limitDiaryPreviewTags', () => {
  it('returns all tags when within limit', () => {
    expect(limitDiaryPreviewTags(['a', 'b', 'c'])).toEqual({
      visibleTags: ['a', 'b', 'c'],
      overflowCount: 0
    })
  })

  it('truncates extra tags and reports overflow count', () => {
    expect(limitDiaryPreviewTags(['a', 'b', 'c', 'd', 'e', 'f'], 4)).toEqual({
      visibleTags: ['a', 'b', 'c', 'd'],
      overflowCount: 2
    })
  })

  it('normalizes input via normalizeDiaryTags before limiting', () => {
    expect(limitDiaryPreviewTags(['one', ' two ', 'three', 'four', 'five'], 3)).toEqual({
      visibleTags: ['one', 'two', 'three'],
      overflowCount: 2
    })
  })
})

describe('normalizeDiaryTags', () => {
  it('trims and drops empty entries', () => {
    expect(normalizeDiaryTags([' a ', '', 'b'])).toEqual(['a', 'b'])
  })

  it('splits comma-separated strings', () => {
    expect(normalizeDiaryTags('工作, 日记')).toEqual(['工作', '日记'])
  })

  it('parses JSON array strings', () => {
    expect(normalizeDiaryTags('["工作", "日记"]')).toEqual(['工作', '日记'])
  })
})

describe('buildDiaryEmbeddingTagPrefix', () => {
  it('returns empty string when no tags', () => {
    expect(buildDiaryEmbeddingTagPrefix(undefined)).toBe('')
    expect(buildDiaryEmbeddingTagPrefix('')).toBe('')
  })

  it('formats normalized tags for embedding prefix', () => {
    expect(buildDiaryEmbeddingTagPrefix('工作,日记')).toBe('[标签: 工作, 日记] ')
  })
})
