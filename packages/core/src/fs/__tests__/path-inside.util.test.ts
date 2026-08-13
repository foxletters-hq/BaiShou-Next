import { describe, it, expect } from 'vitest'
import { isPathInside, resolve } from '../path.util'

describe('isPathInside', () => {
  it('允许根内相对路径', () => {
    const base = resolve('/vault/Notebooks')
    expect(isPathInside(base, resolve(base, 'nb1/sources/a.pdf'))).toBe(true)
    expect(isPathInside(base, base)).toBe(true)
  })

  it('拒绝 .. 跳出根目录', () => {
    const base = resolve('/vault/Notebooks')
    expect(isPathInside(base, resolve(base, '../secret.txt'))).toBe(false)
    expect(isPathInside(base, resolve(base, 'nb1/../../secret.txt'))).toBe(false)
  })
})
