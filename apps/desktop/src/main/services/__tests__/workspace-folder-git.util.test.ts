import * as path from 'path'
import { describe, expect, it } from 'vitest'
import {
  parseGitNameOnlyOutput,
  parseGitNulSeparatedPaths,
  resolveWorkspaceFolderGitRoot,
  toGitShowSpec,
  toWorkspaceHistoryEntries
} from '@baishou/core-desktop'

describe('resolveWorkspaceFolderGitRoot', () => {
  it('uses the folder itself and does not walk to a parent repo', () => {
    const folderRoot = path.join('D:', 'Code-Dev', 'app', 'apps', 'desktop', 'notes')
    const context = resolveWorkspaceFolderGitRoot(folderRoot)
    expect(context.gitRoot).toBe(path.resolve(folderRoot))
    expect(context.gitRoot).toBe(context.folderRoot)
    expect(context.scopePrefix).toBe('')
  })
})

describe('toGitShowSpec', () => {
  it('joins revision and a normalized path', () => {
    expect(toGitShowSpec('abc1234', 'notes\\日记.md')).toBe('abc1234:notes/日记.md')
    expect(toGitShowSpec('abc1234~1', 'notes/日记.md')).toBe('abc1234~1:notes/日记.md')
  })
})

describe('parseGitNameOnlyOutput', () => {
  it('splits name-only lines', () => {
    expect(parseGitNameOnlyOutput('README.md\n修订/规范.md\n\n')).toEqual([
      'README.md',
      '修订/规范.md'
    ])
  })
})

describe('parseGitNulSeparatedPaths', () => {
  it('splits NUL-delimited paths from git -z', () => {
    expect(parseGitNulSeparatedPaths('a.md\0b.md\0')).toEqual(['a.md', 'b.md'])
  })
})

describe('toWorkspaceHistoryEntries', () => {
  it('marks the HEAD commit and keeps short hashes', () => {
    const entries = toWorkspaceHistoryEntries(
      [
        { hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', message: '最新', date: '2026-09-01T00:00:00Z' },
        { hash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', message: '更早', date: '2026-08-01T00:00:00Z' }
      ],
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    )
    expect(entries).toHaveLength(2)
    expect(entries[0]?.commit.hash).toBe('aaaaaaa')
    expect(entries[0]?.isCurrent).toBe(true)
    expect(entries[1]?.isCurrent).toBe(false)
    expect(entries[0]?.commit.message).toBe('最新')
  })
})
