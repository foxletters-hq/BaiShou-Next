import { describe, expect, it } from 'vitest'
import {
  displayGitBranchName,
  isGitCheckoutBlockedByLocalChanges,
  listCheckoutBranches
} from '../workbench-git-branch.util'

describe('listCheckoutBranches', () => {
  it('drops HEAD and marks the current branch', () => {
    expect(listCheckoutBranches('master', ['HEAD', 'master', 'feature/a'])).toEqual([
      { name: 'master', isCurrent: true },
      { name: 'feature/a', isCurrent: false }
    ])
  })

  it('returns an empty list when there are no named branches', () => {
    expect(listCheckoutBranches(undefined, undefined)).toEqual([])
    expect(listCheckoutBranches('HEAD', ['HEAD'])).toEqual([])
  })
})

describe('isGitCheckoutBlockedByLocalChanges', () => {
  it('should detect a checkout blocked by uncommitted edits', () => {
    expect(
      isGitCheckoutBlockedByLocalChanges(
        'Your local changes to the following files would be overwritten by checkout'
      )
    ).toBe(true)
    expect(isGitCheckoutBlockedByLocalChanges('pathspec did not match')).toBe(false)
    expect(isGitCheckoutBlockedByLocalChanges(undefined)).toBe(false)
  })
})

describe('displayGitBranchName', () => {
  it('hides unnamed or detached HEAD', () => {
    expect(displayGitBranchName('master')).toBe('master')
    expect(displayGitBranchName('HEAD')).toBeUndefined()
    expect(displayGitBranchName('  ')).toBeUndefined()
  })
})
