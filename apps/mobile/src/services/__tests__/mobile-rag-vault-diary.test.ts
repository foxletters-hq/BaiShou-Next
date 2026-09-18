import { describe, expect, it } from 'vitest'
import { resolveDiaryEmbedTagsFromLoadedRow } from '../mobile-rag-diary-embed-tags.util'

describe('resolveDiaryEmbedTagsFromLoadedRow', () => {
  it('should use tags from the loaded diary row', () => {
    expect(resolveDiaryEmbedTagsFromLoadedRow({ tags: ['工作', '灵感'] })).toEqual(['工作', '灵感'])
  })

  it('should parse a diary-service string tags field', () => {
    expect(resolveDiaryEmbedTagsFromLoadedRow({ tags: '工作,生活' })).toEqual(['工作', '生活'])
  })

  it('should merge stored tags with inline content tags', () => {
    expect(
      resolveDiaryEmbedTagsFromLoadedRow({
        tags: ['日记'],
        content: '今天 #生活 很开心'
      })
    ).toEqual(['日记', '生活'])
  })

  it('should use an empty list when the loaded row has no tags', () => {
    expect(resolveDiaryEmbedTagsFromLoadedRow({})).toEqual([])
    expect(resolveDiaryEmbedTagsFromLoadedRow({ tags: undefined })).toEqual([])
    expect(resolveDiaryEmbedTagsFromLoadedRow({ tags: null })).toEqual([])
  })
})
