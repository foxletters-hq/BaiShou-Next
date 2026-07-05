import { describe, it, expect } from 'vitest'
import { parseRedactedThinking } from '../redacted-thinking'

const OPEN_REDacted = '<' + 'redacted_thinking>'
const CLOSE_REDacted = '<' + '/redacted_thinking>'

describe('parseRedactedThinking', () => {
  it('extracts redacted_thinking blocks and sanitizes leaked metadata', () => {
    const content = `${OPEN_REDacted}\n推理\n${CLOSE_REDacted}\n<message-content>正式回复</message-content>`
    const result = parseRedactedThinking(content)

    expect(result.cleanReasoning).toBe('推理')
    expect(result.cleanContent).toBe('正式回复')
  })

  it('sanitizes metadata-only assistant text', () => {
    const content =
      '</thinking>\n<message-time>2026-06-23 11:38</message-time>\n<message-content>嗯，我听着呢。你说。</message-content>'
    const result = parseRedactedThinking(content, '已有推理')

    expect(result.cleanReasoning).toBe('已有推理')
    expect(result.cleanContent).toBe('嗯，我听着呢。你说。')
  })

  it('moves content after close tag in reasoning stream back to body', () => {
    const reasoning = `Let me summarize Jan-May.${CLOSE_REDacted}好的，我把一月到五月的月度总结都翻出来了。`
    const content = '🗓️ 前五个月速览'
    const result = parseRedactedThinking(content, reasoning)

    expect(result.cleanReasoning).toBe('Let me summarize Jan-May.')
    expect(result.cleanContent).toContain('好的，我把一月到五月的月度总结都翻出来了。')
    expect(result.cleanContent).toContain('🗓️ 前五个月速览')
    expect(result.cleanReasoning).not.toContain(CLOSE_REDacted)
    expect(result.cleanReasoning).not.toContain('好的')
  })

  it('strips leading close tag from text stream when thinking lived in reasoning channel', () => {
    const reasoning = 'English planning for the reply.'
    const content = `${CLOSE_REDacted}\n好的，开头段落。\n\n## 标题`
    const result = parseRedactedThinking(content, reasoning)

    expect(result.cleanReasoning).toBe('English planning for the reply.')
    expect(result.cleanContent).toContain('好的，开头段落。')
    expect(result.cleanContent).toContain('## 标题')
    expect(result.cleanContent).not.toContain(CLOSE_REDacted)
  })

  it('sanitizes malformed nested message-time tags from screenshot regression', () => {
    const content =
      '</thinking>\n<message-time>2026-06-23 16:28</message-time>\n<message-content>\n<message-time>2026-06-23 16:28</time>\n嗯，我懂。不是什么狂喜或者激动，就是——'
    const result = parseRedactedThinking(content, 'the achievement still matters.')

    expect(result.cleanReasoning).toBe('the achievement still matters.')
    expect(result.cleanContent).toBe('嗯，我懂。不是什么狂喜或者激动，就是——')
  })
})
