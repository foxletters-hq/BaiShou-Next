import { describe, expect, it } from 'vitest'
import { basenameFromPath, formatFileChangeListPath } from '../file-change.utils'

describe('formatFileChangeListPath', () => {
  it('should keep a single segment as-is', () => {
    expect(formatFileChangeListPath('README.md')).toBe('README.md')
    expect(basenameFromPath('README.md')).toBe('README.md')
  })

  it('should show parent and file when the path is nested', () => {
    expect(formatFileChangeListPath('世界观/设定/规范.md')).toBe('设定/规范.md')
    expect(formatFileChangeListPath('a\\b\\c.md')).toBe('b/c.md')
  })
})
