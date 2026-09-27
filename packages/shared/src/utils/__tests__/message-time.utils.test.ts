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
    const d = new Date(2026, 5, 15, 2, 55)
    expect(buildMessageTimeLine(d)).toBe('<message-time>2026-06-15 02:55</message-time>\n')
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
    const raw = '[2026-06-15 02:55]\n[2026-06-15 02:55]\n哈哈，写代码呢'
    expect(stripLeakedMessageTimeFromAssistantText(raw)).toBe('哈哈，写代码呢')
  })

  it('removes message-time tag lines', () => {
    const raw = '<message-time>2026-06-15 02:55</message-time>\n回复正文'
    expect(stripLeakedMessageTimeFromAssistantText(raw)).toBe('回复正文')
  })

  it('unwraps leaked message-content block', () => {
    const raw =
      '<message-time>2026-06-15 02:55</message-time>\n<message-content>\n回复正文\n</message-content>'
    expect(stripLeakedMessageTimeFromAssistantText(raw)).toBe('回复正文')
  })

  it('unwraps message-content after stray thinking close tag', () => {
    const raw =
      '</thinking>\n<message-time>2026-06-23 11:38</message-time>\n<message-content>嗯，我听着呢。你说。🦊💙</message-content>'
    expect(stripLeakedMessageTimeFromAssistantText(raw)).toBe('嗯，我听着呢。你说。🦊💙')
  })

  it('unwraps nested metadata with malformed message-time close tag', () => {
    const raw =
      '</thinking>\n<message-time>2026-06-23 16:28</message-time>\n<message-content>\n<message-time>2026-06-23 16:28</time>\n嗯，我懂。不是什么狂喜或者激动，就是——'
    expect(stripLeakedMessageTimeFromAssistantText(raw)).toBe(
      '嗯，我懂。不是什么狂喜或者激动，就是——'
    )
  })

  it('returns empty string when only leaked metadata remains', () => {
    const raw =
      '</thinking>\n<message-time>2026-06-23 16:28</message-time>\n<message-content>\n<message-time>2026-06-23 16:28</time>'
    expect(stripLeakedMessageTimeFromAssistantText(raw)).toBe('')
  })

  it('unwraps unclosed message-content block (partial model leak)', () => {
    const raw = '<message-time>2026-07-01 12:00</message-time>\n<message-content>\n你好，今天怎么样'
    expect(stripLeakedMessageTimeFromAssistantText(raw)).toBe('你好，今天怎么样')
  })

  it('strips unclosed message-time prefix glued to reply body', () => {
    const raw =
      '<message-time>2026-09-27 12:38 不客气。以后你就扔现象给我，我短着回。\n剩一件小事记着：那批测试垃圾还在你图谱里躺着。'
    expect(stripLeakedMessageTimeFromAssistantText(raw)).toBe(
      '不客气。以后你就扔现象给我，我短着回。\n剩一件小事记着：那批测试垃圾还在你图谱里躺着。'
    )
  })

  it('strips unclosed message-time when it is the only leftover metadata', () => {
    expect(stripLeakedMessageTimeFromAssistantText('<message-time>2026-09-27 12:38')).toBe('')
  })

  it('keeps a plain timestamp that is not wrapped in message-time tags', () => {
    expect(stripLeakedMessageTimeFromAssistantText('会议改到 2026-09-27 12:38')).toBe(
      '会议改到 2026-09-27 12:38'
    )
  })

  it('strips a leaked conversation_time table from assistant text', () => {
    const raw =
      '<conversation_time>\n1. user 2026-09-27 12:38\n</conversation_time>\n不客气。'
    expect(stripLeakedMessageTimeFromAssistantText(raw)).toBe('不客气。')
  })
})
