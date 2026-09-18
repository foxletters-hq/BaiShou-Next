import { describe, expect, it, vi } from 'vitest'
import { mobileResolveJournalForExtract } from '../mobile-graph-extract'

describe('mobileResolveJournalForExtract', () => {
  it('should return null when the date string is not YYYY-MM-DD', async () => {
    const shadowRepo = { findByDate: vi.fn() }
    expect(await mobileResolveJournalForExtract('2026/09/18', shadowRepo as never)).toBeNull()
    expect(shadowRepo.findByDate).not.toHaveBeenCalled()
  })

  it('should return null when the shadow row has no file path', async () => {
    const shadowRepo = { findByDate: vi.fn().mockResolvedValue({ filePath: '' }) }
    expect(await mobileResolveJournalForExtract('2026-09-18', shadowRepo as never)).toBeNull()
  })

  it('should return the normalized path when a shadow journal exists', async () => {
    const shadowRepo = {
      findByDate: vi.fn().mockResolvedValue({ filePath: '\\Journals\\2026-09-18.md' })
    }
    expect(await mobileResolveJournalForExtract('2026-09-18', shadowRepo as never)).toEqual({
      filePath: 'Journals/2026-09-18.md',
      date: '2026-09-18'
    })
  })
})
