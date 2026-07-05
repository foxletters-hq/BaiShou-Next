import { describe, it, expect } from 'vitest'
import { chatNeedsRichMarkdown } from '../chat-plain-text.util'

describe('chatNeedsRichMarkdown', () => {
  it('returns false for roleplay prose with bold markers', () => {
    const text =
      '**拉提：** 今天的两项模块边界已经梳理完成。这套逻辑设计非常清晰，现在是不是可以继续检查界面细节？'
    expect(chatNeedsRichMarkdown(text)).toBe(false)
  })

  it('returns true for fenced code blocks', () => {
    expect(chatNeedsRichMarkdown('hello\n```js\ncode\n```')).toBe(true)
  })
})
