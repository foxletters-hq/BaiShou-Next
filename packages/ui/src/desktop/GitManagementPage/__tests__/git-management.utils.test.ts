import { describe, expect, it } from 'vitest'
import { gitHistoryTotalPages, interpretCommitResult } from '../git-management.utils'

describe('gitHistoryTotalPages', () => {
  it('uses the counted total and does not invent an extra page', () => {
    expect(gitHistoryTotalPages(25, 20)).toBe(2)
    expect(gitHistoryTotalPages(40, 20)).toBe(2)
    expect(gitHistoryTotalPages(41, 20)).toBe(3)
    expect(gitHistoryTotalPages(0, 20)).toBe(1)
  })
})

describe('interpretCommitResult', () => {
  it('treats a hash with empty files as success', () => {
    expect(interpretCommitResult({ hash: 'abc1234', files: [] })).toEqual({
      ok: true,
      fileCount: 0
    })
  })

  it('counts committed files when present', () => {
    expect(interpretCommitResult({ hash: 'abc1234', files: ['a.md', 'b.md'] })).toEqual({
      ok: true,
      fileCount: 2
    })
  })

  it('treats null or missing hash as no commit', () => {
    expect(interpretCommitResult(null)).toEqual({ ok: false, fileCount: 0 })
    expect(interpretCommitResult({ hash: '', files: ['a.md'] })).toEqual({
      ok: false,
      fileCount: 0
    })
  })
})
