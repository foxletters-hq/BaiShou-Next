import { describe, expect, it } from 'vitest'
import {
  ancestorDirPaths,
  collectTouchedDirPaths,
  resolveExplorerParentDir,
  shouldApplyWorkspaceFsChange,
  toAbsoluteWorkspacePath
} from '../workbench-path.util'

describe('ancestorDirPaths', () => {
  it('should return only the root when the entry is at the workspace root', () => {
    expect(ancestorDirPaths('new.txt')).toEqual([''])
    expect(ancestorDirPaths('')).toEqual([''])
  })

  it('should return each parent directory and not the leaf entry', () => {
    expect(ancestorDirPaths('src/lib/util.ts')).toEqual(['', 'src', 'src/lib'])
    expect(ancestorDirPaths('Makefile')).toEqual([''])
  })
})

describe('collectTouchedDirPaths', () => {
  it('should merge ancestors from several paths and keep root first', () => {
    expect(collectTouchedDirPaths(['src/a.ts', 'docs/guide.md', 'src/a.ts'])).toEqual([
      '',
      'docs',
      'src'
    ])
  })
})

describe('toAbsoluteWorkspacePath', () => {
  it('should join a relative path when the folder root has a trailing slash', () => {
    expect(toAbsoluteWorkspacePath('D:/proj/', 'src\\a.ts')).toBe('D:/proj/src/a.ts')
    expect(toAbsoluteWorkspacePath('D:/proj/', undefined)).toBe('D:/proj')
  })
})

describe('resolveExplorerParentDir', () => {
  it('should use the folder itself when the selection is a directory', () => {
    expect(resolveExplorerParentDir({ relativePath: 'src', isDirectory: true })).toBe('src')
  })

  it('should use the parent when the selection is a file', () => {
    expect(resolveExplorerParentDir({ relativePath: 'src/a.ts', isDirectory: false })).toBe('src')
    expect(resolveExplorerParentDir(null)).toBe('')
  })
})

describe('shouldApplyWorkspaceFsChange', () => {
  it('should apply when the payload has no folderRoot', () => {
    expect(shouldApplyWorkspaceFsChange('D:/proj', undefined)).toBe(true)
  })

  it('should apply when the payload folder matches the current workspace', () => {
    expect(shouldApplyWorkspaceFsChange('D:/proj', 'D:\\proj')).toBe(true)
  })

  it('should skip when the payload belongs to another workspace', () => {
    expect(shouldApplyWorkspaceFsChange('D:/proj', 'D:/other')).toBe(false)
  })
})
