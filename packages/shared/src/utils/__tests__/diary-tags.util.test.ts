import { describe, expect, it } from 'vitest'
import { limitDiaryPreviewTags, normalizeDiaryTags } from '../diary-tags.util'

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
})
