import { describe, it, expect } from 'vitest'
import {
  buildFileChangePartData,
  buildUnifiedDiff,
  computeLineDiffStats
} from '../file-change.part-builder'

describe('file-change.part-builder', () => {
  it('computes line diff stats for modified content', () => {
    const stats = computeLineDiffStats('line1\nline2\n', 'line1\nline3\n')
    expect(stats.deletions).toBe(1)
    expect(stats.additions).toBe(1)
  })

  it('builds unified diff text', () => {
    const diff = buildUnifiedDiff('README.md', 'old\n', 'new\n')
    expect(diff).toContain('--- a/README.md')
    expect(diff).toContain('+new')
    expect(diff).toContain('-old')
  })

  it('builds create change parts with line counts', () => {
    const part = buildFileChangePartData({
      path: 'new.txt',
      kind: 'create',
      beforeContent: null,
      afterContent: 'hello\nworld\n'
    })

    expect(part.additions).toBe(2)
    expect(part.deletions).toBe(0)
    expect(part.preview).toContain('hello')
    expect(part.diff).toBeDefined()
  })

  it('builds delete change parts', () => {
    const part = buildFileChangePartData({
      path: 'gone.txt',
      kind: 'delete',
      beforeContent: 'a\nb\nc\n',
      afterContent: null
    })

    expect(part.additions).toBe(0)
    expect(part.deletions).toBe(3)
    expect(part.preview).toBeUndefined()
  })

  it('builds rename change parts with previous path preview', () => {
    const part = buildFileChangePartData({
      path: 'new-name.md',
      kind: 'rename',
      beforeContent: 'content',
      afterContent: 'content',
      previousPath: 'old-name.md'
    })

    expect(part.preview).toBe('Renamed from old-name.md')
    expect(part.previousPath).toBe('old-name.md')
  })
})
