import { describe, expect, it } from 'vitest'
import { canDropExplorerEntries, resolveDropTargetDir } from '../workbench-file-explorer-dnd.util'

describe('workbench-file-explorer-dnd.util', () => {
  it('resolves drop target for files to parent dir', () => {
    expect(resolveDropTargetDir({ relativePath: 'a/b.txt', isDirectory: false })).toBe('a')
    expect(resolveDropTargetDir({ relativePath: 'a', isDirectory: true })).toBe('a')
    expect(resolveDropTargetDir({ relativePath: null, isDirectory: false })).toBe('')
  })

  it('rejects dropping into self or descendant', () => {
    expect(
      canDropExplorerEntries({
        sourcePaths: ['docs'],
        targetDir: 'docs',
        isCopy: false
      })
    ).toBe(false)
    expect(
      canDropExplorerEntries({
        sourcePaths: ['docs'],
        targetDir: 'docs/nested',
        isCopy: true
      })
    ).toBe(false)
  })

  it('rejects move into current parent but allows copy', () => {
    expect(
      canDropExplorerEntries({
        sourcePaths: ['docs/a.md'],
        targetDir: 'docs',
        isCopy: false
      })
    ).toBe(false)
    expect(
      canDropExplorerEntries({
        sourcePaths: ['docs/a.md'],
        targetDir: 'docs',
        isCopy: true
      })
    ).toBe(true)
  })

  it('allows move into another folder', () => {
    expect(
      canDropExplorerEntries({
        sourcePaths: ['docs/a.md'],
        targetDir: 'src',
        isCopy: false
      })
    ).toBe(true)
  })
})
