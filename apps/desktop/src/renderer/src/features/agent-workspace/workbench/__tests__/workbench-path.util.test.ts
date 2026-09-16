import { describe, expect, it } from 'vitest'
import {
  ancestorDirPaths,
  collectTouchedDirPaths,
  shouldApplyWorkspaceFsChange
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
