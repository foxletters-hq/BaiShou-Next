import { describe, expect, it } from 'vitest'
import { isGarbledExtractText } from '../notebook-ask.util'

describe('notebook-ask.util', () => {
  it('treats replacement-character soup as garbled', () => {
    expect(isGarbledExtractText('结论是对齐仍有分歧。')).toBe(false)
    expect(isGarbledExtractText(`\uFFFD\uFFFD 视听语言是电影艺术的基础。`)).toBe(true)
  })
})
