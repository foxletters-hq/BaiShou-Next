import { describe, expect, it } from 'vitest'
import {
  applyDeletedPathToWorkbenchTabs,
  closeWorkbenchTabs,
  collectTabIdsForDeletedPath,
  isMissingWorkbenchFileError,
  isWorkbenchTabPathDeleted
} from '../workbench-tab-close.util'

describe('isWorkbenchTabPathDeleted', () => {
  it('should match the deleted file itself', () => {
    expect(isWorkbenchTabPathDeleted('docs/术语表.md', 'docs/术语表.md')).toBe(true)
    expect(isWorkbenchTabPathDeleted('docs\\术语表.md', 'docs/术语表.md')).toBe(true)
  })

  it('should match files under a deleted folder', () => {
    expect(isWorkbenchTabPathDeleted('docs/a.md', 'docs')).toBe(true)
    expect(isWorkbenchTabPathDeleted('docs/nested/a.md', 'docs')).toBe(true)
  })

  it('should not match a similarly prefixed sibling', () => {
    expect(isWorkbenchTabPathDeleted('docs-old/a.md', 'docs')).toBe(false)
    expect(isWorkbenchTabPathDeleted('doc', 'docs')).toBe(false)
  })

  it('should ignore empty paths', () => {
    expect(isWorkbenchTabPathDeleted('', 'docs/a.md')).toBe(false)
    expect(isWorkbenchTabPathDeleted('docs/a.md', '')).toBe(false)
    expect(isWorkbenchTabPathDeleted(undefined, 'docs/a.md')).toBe(false)
  })
})

describe('collectTabIdsForDeletedPath', () => {
  it('should collect file tabs and diff tabs that cover the deleted path', () => {
    expect(
      collectTabIdsForDeletedPath(
        [
          { id: 'keep', relativePath: 'readme.md' },
          { id: 'file', relativePath: 'docs/a.md' },
          { id: 'diff', change: { path: 'docs/a.md' } }
        ],
        'docs/a.md'
      )
    ).toEqual(['file', 'diff'])
  })

  it('should keep a read-only commit diff tab when the working file is deleted', () => {
    expect(
      collectTabIdsForDeletedPath(
        [
          { id: 'file', kind: 'markdown', relativePath: 'docs/a.md' },
          { id: 'working-diff', kind: 'git-diff', relativePath: 'docs/a.md' },
          {
            id: 'commit-diff',
            kind: 'git-diff',
            relativePath: 'docs/a.md',
            gitDiffReadOnly: true,
            gitDiffCommitHash: 'abc1234'
          }
        ],
        'docs/a.md'
      )
    ).toEqual(['file', 'working-diff'])
  })
})

describe('closeWorkbenchTabs', () => {
  it('should keep the current tab when a background tab closes', () => {
    const tabs = [
      { id: 'a', relativePath: 'a.md' },
      { id: 'b', relativePath: 'b.md' }
    ]
    expect(closeWorkbenchTabs(tabs, 'a', ['b'])).toEqual({
      tabs: [{ id: 'a', relativePath: 'a.md' }],
      activeTabId: 'a'
    })
  })

  it('should activate the last remaining tab when the current tab closes', () => {
    const tabs = [
      { id: 'a', relativePath: 'a.md' },
      { id: 'b', relativePath: 'b.md' },
      { id: 'c', relativePath: 'c.md' }
    ]
    expect(closeWorkbenchTabs(tabs, 'b', ['b'])).toEqual({
      tabs: [
        { id: 'a', relativePath: 'a.md' },
        { id: 'c', relativePath: 'c.md' }
      ],
      activeTabId: 'c'
    })
  })

  it('should clear the active tab when the last tab closes', () => {
    expect(closeWorkbenchTabs([{ id: 'a', relativePath: 'a.md' }], 'a', ['a'])).toEqual({
      tabs: [],
      activeTabId: null
    })
  })

  it('should keep applying closes against the previous remaining tabs', () => {
    const tabs = [
      { id: 'a', relativePath: 'a.md' },
      { id: 'b', relativePath: 'b.md' },
      { id: 'c', relativePath: 'c.md' }
    ]
    const afterFirst = closeWorkbenchTabs(tabs, 'a', ['a'])
    const afterSecond = closeWorkbenchTabs(afterFirst.tabs, afterFirst.activeTabId, ['b'])
    expect(afterSecond.tabs.map((tab) => tab.id)).toEqual(['c'])
    expect(afterSecond.activeTabId).toBe('c')
  })
})

describe('applyDeletedPathToWorkbenchTabs', () => {
  it('should close every tab under a deleted folder', () => {
    const result = applyDeletedPathToWorkbenchTabs(
      [
        { id: 'keep', relativePath: 'readme.md' },
        { id: 'nested', relativePath: 'docs/a.md' },
        { id: 'folder-file', relativePath: 'docs/b.md' }
      ],
      'nested',
      'docs'
    )
    expect(result).toEqual({
      tabs: [{ id: 'keep', relativePath: 'readme.md' }],
      activeTabId: 'keep'
    })
  })

  it('should not restore a tab that a previous delete already closed', () => {
    const tabs = [
      { id: 'a', relativePath: 'docs/a.md' },
      { id: 'b', relativePath: 'docs/b.md' },
      { id: 'keep', relativePath: 'readme.md' }
    ]
    const afterFirst = applyDeletedPathToWorkbenchTabs(tabs, 'a', 'docs/a.md')
    const afterSecond = applyDeletedPathToWorkbenchTabs(
      afterFirst.tabs,
      afterFirst.activeTabId,
      'docs/b.md'
    )
    expect(afterSecond.tabs.map((tab) => tab.id)).toEqual(['keep'])
    expect(afterSecond.activeTabId).toBe('keep')
  })

  it('should keep a read-only commit diff after the working file is deleted', () => {
    const result = applyDeletedPathToWorkbenchTabs(
      [
        { id: 'file', kind: 'markdown', relativePath: 'docs/a.md' },
        {
          id: 'commit-diff',
          kind: 'git-diff',
          relativePath: 'docs/a.md',
          gitDiffReadOnly: true,
          gitDiffCommitHash: 'abc1234'
        }
      ],
      'file',
      'docs/a.md'
    )
    expect(result.tabs.map((tab) => tab.id)).toEqual(['commit-diff'])
    expect(result.activeTabId).toBe('commit-diff')
  })
})

describe('isMissingWorkbenchFileError', () => {
  it('should recognize a missing file from the filesystem', () => {
    expect(
      isMissingWorkbenchFileError(
        new Error("ENOENT: no such file or directory, stat 'D:\\\\proj\\\\a.md'")
      )
    ).toBe(true)
  })

  it('should not treat other read failures as a missing file', () => {
    expect(isMissingWorkbenchFileError(new Error('Not a file'))).toBe(false)
    expect(isMissingWorkbenchFileError(new Error('EACCES: permission denied'))).toBe(false)
  })
})
