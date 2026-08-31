import { describe, expect, it } from 'vitest'
import { getFileStatusIcon, splitGitDisplayPath } from '../git-workbench.utils'

describe('git-workbench.utils', () => {
  it('maps status to a single letter', () => {
    expect(getFileStatusIcon('added')).toBe('A')
    expect(getFileStatusIcon('deleted')).toBe('D')
    expect(getFileStatusIcon('renamed')).toBe('R')
    expect(getFileStatusIcon('untracked')).toBe('U')
    expect(getFileStatusIcon('modified')).toBe('M')
  })

  it('splits a nested path into name and directory', () => {
    expect(splitGitDisplayPath('修订/问题清单.md')).toEqual({
      name: '问题清单.md',
      dir: '修订'
    })
    expect(splitGitDisplayPath('README.md')).toEqual({
      name: 'README.md',
      dir: ''
    })
  })
})
