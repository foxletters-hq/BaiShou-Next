import { describe, expect, it } from 'vitest'
import { normalizeCJKSpacing } from '../index'

describe('normalizeCJKSpacing', () => {
  it('should strip spaces between CJK characters when normalizing', () => {
    expect(normalizeCJKSpacing('中 文')).toBe('中文')
  })

  it('should strip spaces between CJK characters and digits when normalizing', () => {
    expect(normalizeCJKSpacing('第 1 章')).toBe('第1章')
  })
})
