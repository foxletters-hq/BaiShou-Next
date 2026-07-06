import { describe, expect, it } from 'vitest'
import type { DiaryListEntryData } from '../hooks/useDiaryData'
import { applyDiaryListSavedPatch } from '../diary-list-saved-patch.util'

describe('applyDiaryListSavedPatch', () => {
  it('updates preview for matching entry id', () => {
    const entries: DiaryListEntryData[] = [
      {
        id: 1,
        date: new Date('2026-01-01'),
        content: '旧预览',
        preview: '旧预览',
        tags: []
      }
    ]
    const next = applyDiaryListSavedPatch(entries, { id: 1, preview: '**新预览**' })
    expect(next?.[0]?.preview).toBe('**新预览**')
  })

  it('returns null when id not in current page', () => {
    const entries: DiaryListEntryData[] = [
      {
        id: 1,
        date: new Date('2026-01-01'),
        content: '旧预览',
        preview: '旧预览',
        tags: []
      }
    ]
    expect(applyDiaryListSavedPatch(entries, { id: 99, preview: '新' })).toBeNull()
  })
})
