import { describe, it, expect } from 'vitest'
import {
  buildMessageTimeLine,
  wrapMessageBodyForModel,
  wrapMessageContentBlock,
  prefixTextWithMessageTimestamp,
  stripLeakedMessageTimeFromAssistantText
} from '../message-time.utils'

describe('buildMessageTimeLine', () => {
  it('wraps timestamp in message-time tag', () => {
    const d = new Date(2026, 0, 15, 10, 0)
    expect(buildMessageTimeLine(d)).toBe('<message-time>2026-01-15 10:00</message-time>\n')
  })
})

describe('wrapMessageContentBlock', () => {
  it('wraps non-empty body', () => {
    expect(wrapMessageContentBlock('hello')).toBe('<message-content>\nhello\n</message-content>')
  })

  it('allows empty content block', () => {
    expect(wrapMessageContentBlock('')).toBe('<message-content></message-content>')
  })
})

describe('wrapMessageBodyForModel', () => {
  it('combines message-time and message-content', () => {
    const d = new Date(2026, 0, 1, 12, 0)
    expect(wrapMessageBodyForModel('hello', d)).toBe(
      '<message-time>2026-01-01 12:00</message-time>\n<message-content>\nhello\n</message-content>'
    )
  })
})

describe('prefixTextWithMessageTimestamp', () => {
  it('delegates to wrapMessageBodyForModel', () => {
    const d = new Date(2026, 0, 1, 12, 0)
    expect(prefixTextWithMessageTimestamp('hello', d)).toBe(wrapMessageBodyForModel('hello', d))
  })
})

describe('stripLeakedMessageTimeFromAssistantText', () => {
  it('removes repeated bracket timestamps', () => {
    const raw = '[2026-01-15 10:00]\n[2026-01-15 10:00]\n哈哈，在调试构建脚本呢'
    expect(stripLeakedMessageTimeFromAssistantText(raw)).toBe('哈哈，在调试构建脚本呢')
  })

  it('removes message-time tag lines', () => {
    const raw = '<message-time>2026-01-15 10:00</message-time>\n回复正文'
    expect(stripLeakedMessageTimeFromAssistantText(raw)).toBe('回复正文')
  })

  it('unwraps leaked message-content block', () => {
    const raw =
      '<message-time>2026-01-15 10:00</message-time>\n<message-content>\n回复正文\n</message-content>'
    expect(stripLeakedMessageTimeFromAssistantText(raw)).toBe('回复正文')
  })
})
