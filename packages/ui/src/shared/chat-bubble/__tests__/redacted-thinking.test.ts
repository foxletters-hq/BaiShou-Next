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
      '</thinking>\n<message-time>2026-02-10 14:20</message-time>\n<message-content>好的，这个问题我们已经定位到了。</message-content>'
    const result = parseRedactedThinking(content, '已有推理')

    expect(result.cleanReasoning).toBe('已有推理')
    expect(result.cleanContent).toBe('好的，这个问题我们已经定位到了。')
  })
})
