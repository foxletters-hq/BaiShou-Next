import { describe, expect, it } from 'vitest'
import { buildDiaryListSavedPatch } from '../diary-list-saved-patch.util'

describe('buildDiaryListSavedPatch', () => {
  it('builds preview with markdown preserved', () => {
    const patch = buildDiaryListSavedPatch({
      id: 1,
      content: '##### 12:30\n\n正文 **加粗**'
    })
    expect(patch).toEqual({
      id: 1,
      preview: '##### 12:30\n\n正文 **加粗**',
      tags: []
    })
  })

  it('returns null without id', () => {
    expect(buildDiaryListSavedPatch({ content: 'x' })).toBeNull()
  })

  it('reads tags from diary body when metadata tags are empty', () => {
    const patch = buildDiaryListSavedPatch({
      id: 2,
      content: '##### 12:30\n\n#工作\n\n开会',
      tags: ''
    })
    expect(patch?.tags).toEqual(['工作'])
  })
})
