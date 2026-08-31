import { describe, expect, it } from 'vitest'
import { listNotebookCoverEmojis } from '../notebook-cover-emojis'

describe('listNotebookCoverEmojis', () => {
  it('returns the full colorful set when the query is empty', () => {
    const all = listNotebookCoverEmojis('')
    expect(all.length).toBeGreaterThan(60)
    expect(all).toContain('📖')
    expect(all).toContain('🎯')
  })

  it('filters by group keywords', () => {
    const books = listNotebookCoverEmojis('笔记')
    expect(books).toContain('📖')
    expect(books).not.toContain('🐶')
  })
})
