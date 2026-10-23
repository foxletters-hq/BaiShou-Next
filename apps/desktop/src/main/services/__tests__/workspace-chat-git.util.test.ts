import { describe, expect, it } from 'vitest'
import { collectExtraRollbackPaths, countWorkspaceGitChanges } from '../workspace-chat-git.util'

describe('workspace-chat-git.util', () => {
  it('should count staged, unstaged and untracked changes', () => {
    expect(
      countWorkspaceGitChanges({
        staged: ['a'],
        unstaged: ['b', 'c'],
        untracked: ['d']
      })
    ).toBe(4)
  })

  it('should return null when git status is unavailable', () => {
    expect(countWorkspaceGitChanges(null)).toBeNull()
  })

  it('should list extra rollback paths only when the round diff is available', () => {
    expect(collectExtraRollbackPaths(['src/a.ts'], ['src/a.ts', 'src/b.ts'], false)).toEqual([])
    expect(collectExtraRollbackPaths(['src/a.ts'], ['src/b.ts', 'src/a.ts'], true)).toEqual([
      'src/b.ts'
    ])
  })
})
