import { describe, it, expect } from 'vitest'
import {
  buildJournalTreeSkipSqlLikeClauses,
  isJournalPathUnderSkippedDir,
  JOURNAL_TREE_SKIP_DIR_NAMES
} from '../journal-tree-skip.util'

describe('journal-tree-skip.util', () => {
  it('detects Archives in absolute and relative paths', () => {
    expect(
      isJournalPathUnderSkippedDir('D:\\life-book\\2.日记\\Archives\\Weekly\\2025\\2025-01-06.md')
    ).toBe(true)
    expect(isJournalPathUnderSkippedDir('2.日记/Archives/Weekly/2025/2025-01-06.md')).toBe(true)
    expect(isJournalPathUnderSkippedDir('/vault/Journals/2024/06/2024-06-01.md')).toBe(false)
  })

  it('builds SQL LIKE clauses for each skip dir', () => {
    const clauses = buildJournalTreeSkipSqlLikeClauses('file_path')
    expect(clauses.length).toBe(JOURNAL_TREE_SKIP_DIR_NAMES.size * 4)
    expect(clauses.some((c) => c.includes("file_path NOT LIKE '%/Archives/%'"))).toBe(true)
  })
})
