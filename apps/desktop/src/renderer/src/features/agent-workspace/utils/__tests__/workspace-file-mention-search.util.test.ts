import { describe, expect, it, vi } from 'vitest'
import {
  rankFileMentionCandidates,
  searchWorkspaceFileNames
} from '../workspace-file-mention-search.util'

describe('rankFileMentionCandidates', () => {
  it('puts recent open files first and de-duplicates search hits', () => {
    expect(
      rankFileMentionCandidates({
        query: 'app',
        recentPaths: ['src/app.ts', 'README.md'],
        searchedPaths: ['src/app.ts', 'src/app.test.ts']
      })
    ).toEqual([
      { path: 'src/app.ts', group: 'recent' },
      { path: 'src/app.test.ts', group: 'search' }
    ])
  })
})

describe('searchWorkspaceFileNames', () => {
  it('does not walk the tree when the query is empty', async () => {
    const listDir = vi.fn()
    await expect(
      searchWorkspaceFileNames({
        folderRoot: '/tmp/proj',
        query: '   ',
        listDir
      })
    ).resolves.toEqual([])
    expect(listDir).not.toHaveBeenCalled()
  })
})
