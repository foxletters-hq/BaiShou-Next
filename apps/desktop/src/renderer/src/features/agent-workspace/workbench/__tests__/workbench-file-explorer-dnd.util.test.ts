import { describe, expect, it } from 'vitest'
import {
  canDropExplorerEntries,
  parseExplorerDndPayload,
  resolveDropTargetDir,
  WORKBENCH_EXPLORER_DND_MIME,
  writeExplorerDndPayload
} from '../workbench-file-explorer-dnd.util'

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

  it('should keep directory flags when writing explorer drag payload', () => {
    const stored = new Map<string, string>()
    const dataTransfer = {
      setData: (type: string, value: string) => {
        stored.set(type, value)
      },
      getData: (type: string) => stored.get(type) ?? '',
      effectAllowed: 'none'
    } as unknown as DataTransfer
    writeExplorerDndPayload(dataTransfer, {
      relativePaths: ['设定'],
      entries: [{ relativePath: '设定', isDirectory: true }]
    })
    expect(stored.has(WORKBENCH_EXPLORER_DND_MIME)).toBe(true)
    expect(parseExplorerDndPayload(dataTransfer)).toEqual({
      relativePaths: ['设定'],
      entries: [{ relativePath: '设定', isDirectory: true }]
    })
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
