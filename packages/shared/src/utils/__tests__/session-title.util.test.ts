import { describe, expect, it } from 'vitest'
import { deriveSessionTitleFromUserText } from '../session-title.util'

describe('deriveSessionTitleFromUserText', () => {
  it('returns empty string for blank input', () => {
    expect(deriveSessionTitleFromUserText('   ')).toBe('')
  })

  it('truncates to 10 characters by default', () => {
    expect(deriveSessionTitleFromUserText('这是一段比较长的用户首句内容')).toBe(
      '这是一段比较长的用户'
    )
    expect(deriveSessionTitleFromUserText('Hello world from user')).toBe('Hello worl')
  })

  it('supports custom max length', () => {
    expect(deriveSessionTitleFromUserText('abcdefgh', 5)).toBe('abcde')
  })
})
