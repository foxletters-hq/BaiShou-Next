import { describe, expect, it } from 'vitest'
import { assertSafeSyncRelPath, UnsafeSyncRelPathError } from '../sync-rel-path.util'

describe('assertSafeSyncRelPath', () => {
  it('accepts normal vault-relative paths', () => {
    expect(assertSafeSyncRelPath('Personal/a.md')).toBe('Personal/a.md')
    expect(assertSafeSyncRelPath('工作\\笔记.md')).toBe('工作/笔记.md')
    expect(assertSafeSyncRelPath('/Personal/a.md')).toBe('Personal/a.md')
  })

  it('rejects .. and . segments', () => {
    expect(() => assertSafeSyncRelPath('../x.md')).toThrow(UnsafeSyncRelPathError)
    expect(() => assertSafeSyncRelPath('Personal/../x.md')).toThrow(UnsafeSyncRelPathError)
    expect(() => assertSafeSyncRelPath('Personal/./a.md')).toThrow(UnsafeSyncRelPathError)
    expect(() => assertSafeSyncRelPath('..')).toThrow(UnsafeSyncRelPathError)
  })

  it('rejects empty, absolute, and empty segments', () => {
    expect(() => assertSafeSyncRelPath('')).toThrow(UnsafeSyncRelPathError)
    expect(() => assertSafeSyncRelPath('   ')).toThrow(UnsafeSyncRelPathError)
    expect(() => assertSafeSyncRelPath('C:/vault/a.md')).toThrow(UnsafeSyncRelPathError)
    expect(() => assertSafeSyncRelPath('a//b.md')).toThrow(UnsafeSyncRelPathError)
  })
})
