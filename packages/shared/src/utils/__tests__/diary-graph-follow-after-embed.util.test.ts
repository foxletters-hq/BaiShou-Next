import { describe, expect, it } from 'vitest'
import {
  isDiaryGraphFollowCancelled,
  selectDiaryGraphFollowUpItems
} from '../diary-graph-follow-after-embed.util'

describe('selectDiaryGraphFollowUpItems', () => {
  it('should keep only diaries still pending reextract', () => {
    const items = selectDiaryGraphFollowUpItems({
      wanted: [
        { filePath: 'Journal\\a.md', contentHash: 'h1' },
        { filePath: 'Journal/b.md', contentHash: 'h2' }
      ],
      pendingReextract: [{ filePath: 'Journal/a.md', contentHash: 'h1', date: '2026-09-01' }]
    })
    expect(items).toEqual([{ filePath: 'Journal/a.md', date: '2026-09-01', contentHash: 'h1' }])
  })

  it('should not enqueue the same path twice', () => {
    const items = selectDiaryGraphFollowUpItems({
      wanted: [
        { filePath: 'Journal/a.md', contentHash: 'h1' },
        { filePath: 'Journal\\a.md', contentHash: 'h1' }
      ],
      pendingReextract: [{ filePath: 'Journal/a.md', contentHash: 'h1' }]
    })
    expect(items).toHaveLength(1)
  })
})

describe('isDiaryGraphFollowCancelled', () => {
  it('should block the same path and hash after cancel', () => {
    const cancelled = new Map([['Journal/a.md', 'h1']])
    expect(
      isDiaryGraphFollowCancelled({
        filePath: 'Journal\\a.md',
        contentHash: 'h1',
        cancelled
      })
    ).toBe(true)
  })

  it('should allow the same path when content hash changed', () => {
    const cancelled = new Map([['Journal/a.md', 'h1']])
    expect(
      isDiaryGraphFollowCancelled({
        filePath: 'Journal/a.md',
        contentHash: 'h2',
        cancelled
      })
    ).toBe(false)
  })
})
