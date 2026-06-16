import { describe, expect, it } from 'vitest'
import { normalizeDiaryTags } from '../diary-tags.util'

describe('normalizeDiaryTags', () => {
  it('returns empty array for nullish values', () => {
    expect(normalizeDiaryTags(null)).toEqual([])
    expect(normalizeDiaryTags(undefined)).toEqual([])
    expect(normalizeDiaryTags('')).toEqual([])
  })

  it('parses comma-separated strings', () => {
    expect(normalizeDiaryTags('photo, 日记,测试')).toEqual(['photo', '日记', '测试'])
  })

  it('passes through string arrays', () => {
    expect(normalizeDiaryTags(['photo', '日记'])).toEqual(['photo', '日记'])
  })
})
