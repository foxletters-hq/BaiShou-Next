import { describe, it, expect } from 'vitest'
import { chatNeedsRichMarkdown } from '../chat-plain-text.util'

describe('chatNeedsRichMarkdown', () => {
  it('returns false for roleplay prose with bold markers', () => {
    const text =
      '**樱：** 所以白守今天的两个重要边界都画好了。安安，你真的好厉害。现在是不是可以专心修表情包？'
    expect(chatNeedsRichMarkdown(text)).toBe(false)
  })

  it('returns true for fenced code blocks', () => {
    expect(chatNeedsRichMarkdown('hello\n```js\ncode\n```')).toBe(true)
  })
})
