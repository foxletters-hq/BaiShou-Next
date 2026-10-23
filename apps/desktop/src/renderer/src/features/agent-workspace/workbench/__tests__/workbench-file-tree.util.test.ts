import { describe, expect, it } from 'vitest'
import {
  collapsedExplorerExpandedPaths,
  explorerHasCollapsibleFolders,
  nextExplorerFolderToggleAction,
  restoreExplorerExpandedPaths,
  snapshotExplorerExpandedPaths,
  workbenchTreeTwistieOffset
} from '../workbench-file-tree.util'

describe('workbench-file-tree.util', () => {
  it('keeps the same twistie offset for every item at the same depth', () => {
    expect(workbenchTreeTwistieOffset(0)).toBe(8)
    expect(workbenchTreeTwistieOffset(1)).toBe(16)
    expect(workbenchTreeTwistieOffset(2)).toBe(24)
  })

  it('keeps only the virtual root after collapse', () => {
    expect([...collapsedExplorerExpandedPaths()]).toEqual([''])
  })

  it('detects whether any folder besides root is expanded', () => {
    expect(explorerHasCollapsibleFolders([''])).toBe(false)
    expect(explorerHasCollapsibleFolders(['', 'src'])).toBe(true)
    expect(explorerHasCollapsibleFolders(new Set(['docs/api']))).toBe(true)
  })

  it('snapshots expanded folders without the virtual root', () => {
    expect(snapshotExplorerExpandedPaths(['', 'src', 'docs'])).toEqual(['src', 'docs'])
  })

  it('restores snapshot plus the virtual root', () => {
    expect([...restoreExplorerExpandedPaths(['src'])].sort()).toEqual(['', 'src'])
  })

  it('toggles collapse when folders are open and expand when they are not', () => {
    expect(nextExplorerFolderToggleAction(['', 'src'])).toBe('collapse')
    expect(nextExplorerFolderToggleAction([''])).toBe('expand')
  })
})
